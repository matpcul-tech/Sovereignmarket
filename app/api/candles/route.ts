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
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY not configured');

  const now = Math.floor(Date.now() / 1000);
  // Tighter windows per resolution — smaller requests work better on free tier
  const windowMap: Record<string, number> = {
    '1':  1 * 24 * 60 * 60,   // 1 day  for 1m
    '5':  2 * 24 * 60 * 60,   // 2 days for 5m
    '15': 5 * 24 * 60 * 60,   // 5 days for 15m
    '60': 14 * 24 * 60 * 60,  // 2 weeks for 1h
    'D':  365 * 24 * 60 * 60, // 1 year for daily
  };
  const from = now - (windowMap[resolution] ?? 5 * 24 * 60 * 60);

  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${now}&token=${key}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Finnhub candle error: ${res.status}`);
  const json = await res.json();

  if (json.s === 'no_data' || !json.t || json.t.length === 0) {
    throw new Error('No candle data — market may be closed or try a longer timeframe');
  }
  if (json.s !== 'ok') throw new Error(`Finnhub candles: ${json.s}`);

  const candles = (json.t as number[]).map((t, i) => ({
    time: t * 1000,
    open: json.o[i],
    high: json.h[i],
    low: json.l[i],
    close: json.c[i],
    volume: json.v[i],
  })).sort((a, b) => a.time - b.time);

  return { symbol, resolution, candles };
}

async function fetchCryptoCandles(symbol: string, resolution: string) {
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
