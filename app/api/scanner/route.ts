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

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'gappers';
  const cacheKey = `scan:${type}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
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
    let results;

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
      // Without bulk volume data on free tier, we proxy with high % movers
      // In production with paid feed, swap to actual volume/avgVolume ratio
      results = valid
        .map((q) => ({
          symbol: q.symbol,
          price: q.c,
          change: q.d,
          changePercent: q.dp,
          metric: `Range $${(q.h - q.l).toFixed(2)}`,
          tag: 'vol',
        }))
        .sort((a, b) => (b.high - b.low) - (a.high - a.low))
        .slice(0, 10);
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
