import { NextRequest, NextResponse } from 'next/server';

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_MS = 60_000; // 1 min cache for candles

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
  // Finnhub free tier: only resolution=D (daily) is reliable on free
  // For intraday on free tier we use Alpha Vantage TIME_SERIES_INTRADAY
  const avKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!avKey) throw new Error('ALPHA_VANTAGE_API_KEY not configured');

  const avInterval = mapResolutionToAV(resolution);
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(symbol)}&interval=${avInterval}&outputsize=compact&apikey=${avKey}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Alpha Vantage error: ${res.status}`);
  const json = await res.json();

  const seriesKey = `Time Series (${avInterval})`;
  const series = json[seriesKey];
  if (!series) {
    if (json['Note']) throw new Error('Alpha Vantage rate limit hit - 25 calls/day on free tier');
    if (json['Information']) throw new Error('Alpha Vantage: ' + json['Information']);
    throw new Error('No data returned');
  }

  const candles = Object.entries(series)
    .map(([time, ohlc]: [string, any]) => ({
      time: new Date(time).getTime(),
      open: parseFloat(ohlc['1. open']),
      high: parseFloat(ohlc['2. high']),
      low: parseFloat(ohlc['3. low']),
      close: parseFloat(ohlc['4. close']),
      volume: parseFloat(ohlc['5. volume']),
    }))
    .sort((a, b) => a.time - b.time);

  return { symbol, resolution, candles };
}

async function fetchCryptoCandles(symbol: string, resolution: string) {
  const interval = mapResolutionToBinance(resolution);
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=200`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Binance error: ${res.status}`);
  const klines = await res.json();

  const candles = klines.map((k: any[]) => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));

  return { symbol, resolution, candles };
}

function mapResolutionToAV(r: string) {
  const map: Record<string, string> = {
    '1': '1min',
    '5': '5min',
    '15': '15min',
    '30': '30min',
    '60': '60min',
  };
  return map[r] || '15min';
}

function mapResolutionToBinance(r: string) {
  const map: Record<string, string> = {
    '1': '1m',
    '5': '5m',
    '15': '15m',
    '30': '30m',
    '60': '1h',
    'D': '1d',
  };
  return map[r] || '15m';
}
