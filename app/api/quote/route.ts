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
  // Coinbase Exchange - works from US/Vercel, no key needed.
  // binance.com returns 451 (geo-block), binance.us is unreliable.
  const product = toCoinbaseProduct(symbol);

  const [tickerRes, statsRes] = await Promise.all([
    fetch(`https://api.exchange.coinbase.com/products/${product}/ticker`, {
      next: { revalidate: 15 },
    }),
    fetch(`https://api.exchange.coinbase.com/products/${product}/stats`, {
      next: { revalidate: 15 },
    }),
  ]);

  if (!tickerRes.ok) throw new Error(`Coinbase ticker error: ${tickerRes.status}`);
  if (!statsRes.ok) throw new Error(`Coinbase stats error: ${statsRes.status}`);

  const ticker = await tickerRes.json();
  const stats = await statsRes.json();

  const price = parseFloat(ticker.price);
  const open = parseFloat(stats.open);
  const change = price - open;
  const changePercent = open ? (change / open) * 100 : 0;

  return {
    symbol,
    price,
    change,
    changePercent,
    high: parseFloat(stats.high),
    low: parseFloat(stats.low),
    open,
    prevClose: open,
    volume: parseFloat(stats.volume),
    timestamp: new Date(ticker.time).getTime(),
    delayed: false,
  };
}

// BTCUSDT -> BTC-USD, ETHUSDT -> ETH-USD, BTCUSD -> BTC-USD
function toCoinbaseProduct(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith('USDT') || s.endsWith('USDC')) return `${s.slice(0, -4)}-USD`;
  if (s.endsWith('USD')) return `${s.slice(0, -3)}-USD`;
  if (s.includes('-')) return s;
  return `${s}-USD`;
}
