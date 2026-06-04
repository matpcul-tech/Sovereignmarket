'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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

function inferAssetType(sym: string): 'stock' | 'etf' | 'crypto' {
  const upper = sym.toUpperCase();
  if (/USDT$|USD$/.test(upper)) return 'crypto';
  if (['SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'TLT', 'XLF', 'ARKK', 'SMH', 'SOXS', 'TQQQ', 'UVXY'].includes(upper)) return 'etf';
  return 'stock';
}

const LS_WATCHLIST = 'sovereign_watchlist';
const LS_ACTIVE = 'sovereign_active';

export default function Terminal({
  initialWatchlist,
  initialTrades,
}: {
  initialWatchlist: WatchlistItem[];
  initialTrades: Trade[];
}) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  const [trades, setTrades] = useState<Trade[]>(initialTrades);

  // Global symbol state
  const [symbol, setSymbol] = useState<string>(initialWatchlist[0]?.symbol || '');
  const [assetType, setAssetType] = useState<string>(initialWatchlist[0]?.asset_type || 'stock');
  const [displayName, setDisplayName] = useState<string>(initialWatchlist[0]?.display_name || '');
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(initialWatchlist[0]?.id || null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [resolution, setResolution] = useState('15');
  const [loading, setLoading] = useState(false);
  const [signal, setSignal] = useState<any>(null);
  const [signalLoading, setSignalLoading] = useState(false);

  // Track whether localStorage has been read so we don't overwrite it prematurely
  const lsLoaded = useRef(false);

  // Restore watchlist + last active symbol from localStorage on mount
  useEffect(() => {
    try {
      const storedList = localStorage.getItem(LS_WATCHLIST);
      const storedActive = localStorage.getItem(LS_ACTIVE);

      if (storedList !== null) {
        // Once the user has saved a watchlist (even an empty one), respect it.
        // Never overlay the server seed on top of their choices.
        const parsed: WatchlistItem[] = JSON.parse(storedList);
        if (Array.isArray(parsed)) {
          setWatchlist(parsed);
          if (parsed.length > 0) {
            if (storedActive) {
              const active = JSON.parse(storedActive);
              setSymbol(active.symbol);
              setAssetType(active.assetType);
              setDisplayName(active.displayName);
              setActiveWatchlistId(active.watchlistId ?? null);
            } else {
              const first = parsed[0];
              setSymbol(first.symbol);
              setAssetType(first.asset_type);
              setDisplayName(first.display_name);
              setActiveWatchlistId(first.id);
            }
          } else {
            // User has an empty watchlist by choice - clear active symbol too
            setSymbol('');
            setAssetType('stock');
            setDisplayName('');
            setActiveWatchlistId(null);
          }
        }
      }
    } catch {}
    lsLoaded.current = true;
  }, []);

  // Persist watchlist to localStorage whenever it changes (after first load)
  const updateWatchlist = useCallback((items: WatchlistItem[]) => {
    setWatchlist(items);
    try { localStorage.setItem(LS_WATCHLIST, JSON.stringify(items)); } catch {}
  }, []);

  // Unified handler — called by search, watchlist click, and scanner click
  const handleSelectSymbol = useCallback((sym: string, type: string, display: string, wlId: string | null = null) => {
    setSymbol(sym);
    setAssetType(type);
    setDisplayName(display);
    setActiveWatchlistId(wlId);
    setQuote(null);
    setCandles([]);
    setSignal(null);
    try {
      localStorage.setItem(LS_ACTIVE, JSON.stringify({ symbol: sym, assetType: type, displayName: display, watchlistId: wlId }));
    } catch {}
  }, []);

  // Fetch quote + candles for current symbol
  const loadData = useCallback(async (sym: string, type: string) => {
    if (!sym) return;
    setLoading(true);
    try {
      const [qRes, cRes] = await Promise.all([
        fetch(`/api/quote?symbol=${sym}&type=${type}`),
        fetch(`/api/candles?symbol=${sym}&resolution=${resolution}&type=${type}`),
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

  // Load all watchlist quotes for ticker tape + watchlist panel
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

  // Reload when symbol or resolution changes
  useEffect(() => {
    if (symbol) loadData(symbol, assetType);
  }, [symbol, assetType, loadData]);

  // Watchlist quotes on mount and every 30s
  useEffect(() => {
    loadAllQuotes();
    const id = setInterval(loadAllQuotes, 30_000);
    return () => clearInterval(id);
  }, [loadAllQuotes]);

  // Refresh active symbol every 30s
  useEffect(() => {
    if (!symbol) return;
    const id = setInterval(() => loadData(symbol, assetType), 30_000);
    return () => clearInterval(id);
  }, [symbol, assetType, loadData]);

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
    if (!symbol || !quote || candles.length < 5) return;
    setSignalLoading(true);
    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
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
  }, [symbol, quote, candles, indicators]);

  // Auto-generate signal when symbol or price changes
  useEffect(() => {
    if (quote && candles.length >= 5) {
      generateSignal();
    }
  }, [symbol, quote?.price]); // intentionally limited deps

  return (
    <div className="relative z-10 min-h-screen">
      <TopBar
        quote={quote}
        watchlistQuotes={quotes}
        watchlist={watchlist}
        onSearch={(sym) => {
          const type = inferAssetType(sym);
          handleSelectSymbol(sym, type, sym, null);
        }}
      />

      <TickerTape quotes={quotes} watchlist={watchlist} />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-px bg-line min-h-[calc(100vh-100px)]">
        {/* LEFT */}
        <aside className="bg-bg-0 flex flex-col">
          <Scanner
            onSelectSymbol={(sym) => {
              const type = inferAssetType(sym);
              handleSelectSymbol(sym, type, sym, null);
            }}
          />
          <Watchlist
            items={watchlist}
            quotes={quotes}
            activeId={activeWatchlistId}
            onSelect={(item) => handleSelectSymbol(item.symbol, item.asset_type, item.display_name, item.id)}
            onUpdate={updateWatchlist}
          />
        </aside>

        {/* CENTER */}
        <main className="bg-bg-0 flex flex-col">
          <PriceChart
            symbol={symbol}
            displayName={displayName}
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
        <div>Data: Finnhub · Coinbase · 15min Delayed Equities</div>
        <div className="font-serif italic normal-case tracking-normal text-[11px] text-amber-dim">
          Schwabach's Market
        </div>
        <div>v0.1.0 · {new Date().toISOString().split('T')[0]}</div>
      </footer>
    </div>
  );
}
