import { NextRequest, NextResponse } from 'next/server';

// In-memory cache to respect Finnhub's 60/min limit
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_MS = 30_000; // 30s cache

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  const assetType = req.nextUrl.searchParams.get('type') || 'stock';

  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  const cacheKey = `${assetType}:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    let data;
    if (assetType === 'crypto') {
      data = await fetchCrypto(symbol);
    } else {
      data = await fetchStock(symbol);
    }
    cache.set(cacheKey, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function fetchStock(symbol: string) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY not configured');

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
  const q = await res.json();

  // Finnhub fields: c=current, d=change, dp=change%, h=high, l=low, o=open, pc=prev close
  return {
    symbol,
    price: q.c,
    change: q.d,
    changePercent: q.dp,
    high: q.h,
    low: q.l,
    open: q.o,
    prevClose: q.pc,
    timestamp: q.t * 1000,
    delayed: true,
  };
}

async function fetchCrypto(symbol: string) {
  // Binance public API - no key needed, real-time
  // Expects symbols like BTCUSDT, ETHUSDT
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`Binance error: ${res.status}`);
  const q = await res.json();

  return {
    symbol,
    price: parseFloat(q.lastPrice),
    change: parseFloat(q.priceChange),
    changePercent: parseFloat(q.priceChangePercent),
    high: parseFloat(q.highPrice),
    low: parseFloat(q.lowPrice),
    open: parseFloat(q.openPrice),
    prevClose: parseFloat(q.prevClosePrice),
    volume: parseFloat(q.volume),
    timestamp: q.closeTime,
    delayed: false,
  };
}
