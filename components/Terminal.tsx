'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Candle, ema, vwap, rsi, atr, macd } from '@/lib/indicators';
import PriceChart from './PriceChart';
import Watchlist from './Watchlist';
import Scanner from './Scanner';
import SignalPanel from './SignalPanel';
import NewsFeed from './NewsFeed';
import TradeJournal from './TradeJournal';
import TickerTape from './TickerTape';
import TopBar from './TopBar';

interface WatchlistItem {
  id: string;
  symbol: string;
  asset_type: string;
  display_name: string;
  position: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entry_price: number;
  exit_price: number | null;
  size: number;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  setup: string | null;
  status: 'open' | 'closed';
}

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

export default function Terminal({
  userEmail,
  initialWatchlist,
  initialTrades,
}: {
  userEmail: string;
  initialWatchlist: WatchlistItem[];
  initialTrades: Trade[];
}) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [activeSymbol, setActiveSymbol] = useState<WatchlistItem | null>(
    initialWatchlist[0] || null
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [resolution, setResolution] = useState('15');
  const [loading, setLoading] = useState(false);
  const [signal, setSignal] = useState<any>(null);
  const [signalLoading, setSignalLoading] = useState(false);

  // Fetch quote + candles for active symbol
  const loadSymbol = useCallback(async (item: WatchlistItem) => {
    setLoading(true);
    try {
      const [qRes, cRes] = await Promise.all([
        fetch(`/api/quote?symbol=${item.symbol}&type=${item.asset_type}`),
        fetch(`/api/candles?symbol=${item.symbol}&resolution=${resolution}&type=${item.asset_type}`),
      ]);
      const q = await qRes.json();
      const c = await cRes.json();
      if (!q.error) setQuote(q);
      if (!c.error && c.candles) setCandles(c.candles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [resolution]);

  // Load all watchlist quotes
  const loadAllQuotes = useCallback(async () => {
    const results: Record<string, Quote> = {};
    await Promise.all(
      watchlist.map(async (item) => {
        try {
          const r = await fetch(`/api/quote?symbol=${item.symbol}&type=${item.asset_type}`);
          const q = await r.json();
          if (!q.error) results[item.symbol] = q;
        } catch {}
      })
    );
    setQuotes(results);
  }, [watchlist]);

  // Initial load + when active symbol changes
  useEffect(() => {
    if (activeSymbol) loadSymbol(activeSymbol);
  }, [activeSymbol, loadSymbol]);

  // Load watchlist quotes on mount and refresh every 30s
  useEffect(() => {
    loadAllQuotes();
    const id = setInterval(loadAllQuotes, 30_000);
    return () => clearInterval(id);
  }, [loadAllQuotes]);

  // Refresh active symbol every 30s
  useEffect(() => {
    if (!activeSymbol) return;
    const id = setInterval(() => loadSymbol(activeSymbol), 30_000);
    return () => clearInterval(id);
  }, [activeSymbol, loadSymbol]);

  // Compute indicators
  const closes = candles.map((c) => c.close);
  const vwapSeries = candles.length > 0 ? vwap(candles) : [];
  const ema9Series = ema(closes, 9);
  const ema20Series = ema(closes, 20);
  const ema50Series = ema(closes, 50);
  const rsiSeries = rsi(closes, 14);
  const atrSeries = atr(candles, 14);
  const macdResult = macd(closes);

  const lastIdx = candles.length - 1;
  const indicators = {
    vwap: vwapSeries[lastIdx],
    ema9: ema9Series[lastIdx],
    ema20: ema20Series[lastIdx],
    ema50: ema50Series[lastIdx],
    rsi: rsiSeries[lastIdx],
    atr: atrSeries[lastIdx],
    macd: macdResult.macd[lastIdx],
    macdSignal: macdResult.signal[lastIdx],
    volume: candles[lastIdx]?.volume,
  };

  // Generate AI signal
  const generateSignal = useCallback(async () => {
    if (!activeSymbol || !quote || candles.length < 5) return;
    setSignalLoading(true);
    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeSymbol.symbol,
          price: quote.price,
          changePercent: quote.changePercent,
          candles: candles.slice(-30),
          indicators,
        }),
      });
      const data = await res.json();
      if (!data.error) setSignal(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSignalLoading(false);
    }
  }, [activeSymbol, quote, candles, indicators]);

  // Auto-generate signal when symbol or quote changes substantially
  useEffect(() => {
    if (quote && candles.length >= 5) {
      generateSignal();
    }
  }, [activeSymbol?.symbol, quote?.price]); // intentionally limited deps

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="relative z-10 min-h-screen">
      <TopBar
        quote={quote}
        watchlistQuotes={quotes}
        watchlist={watchlist}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />

      <TickerTape quotes={quotes} watchlist={watchlist} />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-px bg-line min-h-[calc(100vh-100px)]">
        {/* LEFT */}
        <aside className="bg-bg-0 flex flex-col">
          <Scanner onSelectSymbol={(sym) => {
            const found = watchlist.find((w) => w.symbol === sym);
            if (found) setActiveSymbol(found);
          }} />
          <Watchlist
            items={watchlist}
            quotes={quotes}
            active={activeSymbol}
            onSelect={setActiveSymbol}
            onUpdate={setWatchlist}
          />
        </aside>

        {/* CENTER */}
        <main className="bg-bg-0 flex flex-col">
          <PriceChart
            symbol={activeSymbol?.symbol || ''}
            displayName={activeSymbol?.display_name || ''}
            quote={quote}
            candles={candles}
            indicators={indicators}
            resolution={resolution}
            onResolutionChange={setResolution}
            loading={loading}
          />
          <TradeJournal trades={trades} onTradesUpdate={setTrades} />
        </main>

        {/* RIGHT */}
        <aside className="bg-bg-0 flex flex-col">
          <SignalPanel
            signal={signal}
            loading={signalLoading}
            onRegenerate={generateSignal}
          />
          <NewsFeed watchlistSymbols={watchlist.map((w) => w.symbol)} />
        </aside>
      </div>

      <footer className="px-6 py-4 bg-bg-1 border-t border-line flex justify-between text-[9px] tracking-[0.15em] uppercase text-text-2">
        <div>Data: Finnhub · Alpha Vantage · Binance · 15min Delayed Equities</div>
        <div className="font-serif italic normal-case tracking-normal text-[11px] text-amber-dim">
          A Sovereign Shield Technologies Product
        </div>
        <div>v0.1.0 · {new Date().toISOString().split('T')[0]}</div>
      </footer>
    </div>
  );
}
