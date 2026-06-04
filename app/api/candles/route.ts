import { NextRequest, NextResponse } from 'next/server';

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_MS = 60_000;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  const resolution = req.nextUrl.searchParams.get('resolution') || '15';
  const assetType = req.nextUrl.searchParams.get('type') || 'stock';

  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  const cacheKey = `${assetType}:${symbol}:${resolution}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    let data;
    if (assetType === 'crypto') {
      data = await fetchCryptoCandles(symbol, resolution);
    } else {
      data = await fetchStockCandles(symbol, resolution);
    }
    cache.set(cacheKey, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function fetchStockCandles(symbol: string, resolution: string) {
  // Yahoo Finance chart API - no key, real-time, generous limits.
  // Finnhub free tier dropped US stock candles in 2024; Alpha Vantage caps at 25/day.
  const { interval, range } = mapResolutionToYahoo(resolution);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: { 'User-Agent': 'Mozilla/5.0 SchwabachsMarket' },
  });
  if (!res.ok) throw new Error(`Yahoo error: ${res.status}`);
  const json = await res.json();

  const result = json?.chart?.result?.[0];
  if (!result) {
    const err = json?.chart?.error?.description || 'No data returned';
    throw new Error(err);
  }

  const timestamps: number[] = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const opens: (number | null)[] = q.open || [];
  const highs: (number | null)[] = q.high || [];
  const lows: (number | null)[] = q.low || [];
  const closes: (number | null)[] = q.close || [];
  const vols: (number | null)[] = q.volume || [];

  const candles = timestamps
    .map((t, i) => ({
      time: t * 1000,
      open: opens[i] ?? null,
      high: highs[i] ?? null,
      low: lows[i] ?? null,
      close: closes[i] ?? null,
      volume: vols[i] ?? 0,
    }))
    .filter((c) => c.open !== null && c.close !== null) as Array<{
      time: number; open: number; high: number; low: number; close: number; volume: number;
    }>;

  return { symbol, resolution, candles };
}

async function fetchCryptoCandles(symbol: string, resolution: string) {
  // Coinbase Exchange - binance.com geo-blocks US Vercel functions
  const product = toCoinbaseProduct(symbol);
  const granularity = mapResolutionToCoinbase(resolution);
  const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${granularity}`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Coinbase candles error: ${res.status}`);
  const rows = await res.json();

  const candles = (rows as any[][])
    .map((k) => ({
      time: k[0] * 1000,
      low: k[1],
      high: k[2],
      open: k[3],
      close: k[4],
      volume: k[5],
    }))
    .sort((a, b) => a.time - b.time);

  return { symbol, resolution, candles };
}

function toCoinbaseProduct(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith('USDT') || s.endsWith('USDC')) return `${s.slice(0, -4)}-USD`;
  if (s.endsWith('USD')) return `${s.slice(0, -3)}-USD`;
  if (s.includes('-')) return s;
  return `${s}-USD`;
}

function mapResolutionToCoinbase(r: string): number {
  const map: Record<string, number> = {
    '1': 60,
    '5': 300,
    '15': 900,
    '30': 900,
    '60': 3600,
    'D': 86400,
  };
  return map[r] || 900;
}

function mapResolutionToYahoo(r: string): { interval: string; range: string } {
  // Yahoo intervals: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1d
  // Intraday intervals require shorter ranges
  const map: Record<string, { interval: string; range: string }> = {
    '1': { interval: '1m', range: '1d' },
    '5': { interval: '5m', range: '5d' },
    '15': { interval: '15m', range: '5d' },
    '30': { interval: '30m', range: '1mo' },
    '60': { interval: '60m', range: '1mo' },
    'D': { interval: '1d', range: '6mo' },
  };
  return map[r] || { interval: '15m', range: '5d' };
}
