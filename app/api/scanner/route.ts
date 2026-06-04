import { NextRequest, NextResponse } from 'next/server';

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_MS = 5 * 60_000; // 5 min cache for scanner

// Common day-trader universe - focus on liquid, volatile names
const SCAN_UNIVERSE = [
  'NVDA', 'TSLA', 'AAPL', 'AMD', 'META', 'MSFT', 'GOOGL', 'AMZN',
  'SPY', 'QQQ', 'IWM', 'DIA',
  'MARA', 'RIOT', 'COIN', 'HOOD', 'SOFI', 'PLTR',
  'SMCI', 'ARM', 'MU', 'AVGO', 'NFLX', 'CRWD',
  'UPST', 'NIO', 'LCID', 'RIVN', 'F', 'GM',
];

// Larger universe for pre-market scouting - common pre-market movers
const PREMARKET_UNIVERSE = [
  ...SCAN_UNIVERSE,
  // Megacaps + indices
  'BRK-B', 'V', 'JPM', 'WMT', 'XOM', 'UNH', 'JNJ', 'PG', 'MA', 'HD',
  // Tech / growth
  'ORCL', 'CRM', 'ADBE', 'PYPL', 'INTC', 'CSCO', 'SHOP', 'SNOW', 'NET',
  'DDOG', 'ZS', 'PANW', 'NOW', 'TEAM', 'ABNB', 'UBER', 'LYFT', 'DASH',
  // Biotech / pharma (frequent pre-market gappers on news)
  'PFE', 'MRNA', 'BNTX', 'NVAX', 'GILD', 'BIIB', 'REGN', 'VRTX', 'LLY',
  // EV / clean energy
  'XPEV', 'LI', 'CHPT', 'PLUG', 'ENPH', 'FSLR', 'RUN',
  // Meme / retail favorites
  'GME', 'AMC', 'BBBY', 'CVNA', 'BYND', 'PTON', 'AFRM',
  // Energy / commodities
  'OXY', 'CVX', 'SLB', 'HAL', 'FCX', 'NEM',
  // Financials
  'BAC', 'WFC', 'C', 'GS', 'MS', 'BLK', 'SCHW',
  // Semi / hardware
  'TSM', 'QCOM', 'TXN', 'ASML', 'MRVL', 'ON',
];

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'gappers';
  const cacheKey = `scan:${type}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    if (type === 'premarket') {
      const results = await scanPremarket();
      const payload = { type, results, asOf: Date.now() };
      cache.set(cacheKey, { data: payload, ts: Date.now() });
      return NextResponse.json(payload);
    }

    const key = process.env.FINNHUB_API_KEY;
    if (!key) throw new Error('FINNHUB_API_KEY not configured');

    // Fetch quotes for all symbols in parallel
    const quotes = await Promise.all(
      SCAN_UNIVERSE.map(async (sym) => {
        try {
          const r = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`,
            { next: { revalidate: 300 } }
          );
          if (!r.ok) return null;
          const q = await r.json();
          return { symbol: sym, ...q };
        } catch {
          return null;
        }
      })
    );

    const valid = quotes.filter((q): q is any => q !== null && q.c > 0);

    let results: Array<{
      symbol: string;
      price: number;
      change: number;
      changePercent: number;
      metric: string;
      tag: string;
    }>;

    if (type === 'gappers') {
      // Sort by absolute % change from previous close
      results = valid
        .map((q) => ({
          symbol: q.symbol,
          price: q.c,
          change: q.d,
          changePercent: q.dp,
          metric: `${q.dp > 0 ? '+' : ''}${q.dp?.toFixed(2)}%`,
          tag: 'gap',
        }))
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 10);
    } else if (type === 'volume') {
      // Without bulk volume data on free tier, we proxy with daily range
      // In production with paid feed, swap to actual volume/avgVolume ratio
      results = valid
        .map((q) => ({
          symbol: q.symbol,
          price: q.c,
          change: q.d,
          changePercent: q.dp,
          range: q.h - q.l,
          metric: `Range $${(q.h - q.l).toFixed(2)}`,
          tag: 'vol',
        }))
        .sort((a, b) => b.range - a.range)
        .slice(0, 10)
        .map(({ range, ...rest }) => rest);
    } else if (type === 'breakouts') {
      // Approximate breakouts: price near daily high
      results = valid
        .filter((q) => q.h > 0 && (q.h - q.c) / q.h < 0.005) // within 0.5% of high
        .map((q) => ({
          symbol: q.symbol,
          price: q.c,
          change: q.d,
          changePercent: q.dp,
          metric: 'At daily high',
          tag: 'brk',
        }))
        .slice(0, 10);
    } else {
      results = [];
    }

    const payload = { type, results, asOf: Date.now() };
    cache.set(cacheKey, { data: payload, ts: Date.now() });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Pre-market scout via Yahoo Finance with extended-hours data
async function scanPremarket() {
  const movers = await Promise.all(
    PREMARKET_UNIVERSE.map(async (sym) => {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            sym
          )}?interval=5m&range=1d&includePrePost=true`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0 SchwabachsMarket' },
            next: { revalidate: 120 },
          }
        );
        if (!r.ok) return null;
        const json = await r.json();
        const result = json?.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta || {};
        const prevClose = meta.chartPreviousClose ?? meta.previousClose;
        if (!prevClose) return null;

        // Get the last available close - during pre-market this is the pre-market price
        const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
        const lastClose = [...closes].reverse().find((c) => c != null) as number | undefined;
        const price = lastClose ?? meta.regularMarketPrice;
        if (!price) return null;

        const changePercent = ((price - prevClose) / prevClose) * 100;
        return { symbol: sym, price, prevClose, changePercent };
      } catch {
        return null;
      }
    })
  );

  const valid = movers.filter((m): m is NonNullable<typeof m> => m !== null);

  return valid
    .filter((m) => Math.abs(m.changePercent) >= 1) // only show movers > 1%
    .map((m) => ({
      symbol: m.symbol,
      price: m.price,
      change: m.price - m.prevClose,
      changePercent: m.changePercent,
      metric: `${m.changePercent > 0 ? '+' : ''}${m.changePercent.toFixed(2)}% pre`,
      tag: 'pre',
    }))
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 15);
}
