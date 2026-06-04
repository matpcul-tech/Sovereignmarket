'use client';

import { useEffect, useState } from 'react';

export default function TopBar({
  quote,
  onSearch,
}: {
  quote: any;
  watchlistQuotes: any;
  watchlist: any[];
  onSearch: (symbol: string) => void;
}) {
  const [time, setTime] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'America/New_York',
        }) + ' ET'
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const sym = searchInput.trim().toUpperCase();
    if (sym) {
      onSearch(sym);
      setSearchInput('');
    }
  }

  // Determine market session
  const now = new Date();
  const nyHour = parseInt(
    now.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false, timeZone: 'America/New_York' }),
    10
  );
  const isWeekend = [0, 6].includes(
    parseInt(now.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' }) === 'Sat' ? '6' : '0')
  );
  let session = 'Closed';
  let sessionColor = 'text-text-2';
  if (!isWeekend) {
    if (nyHour >= 9 && nyHour < 16) {
      session = 'Market Open · 15m Delay';
      sessionColor = 'text-green';
    } else if (nyHour >= 4 && nyHour < 9) {
      session = 'Pre-Market';
      sessionColor = 'text-amber';
    } else if (nyHour >= 16 && nyHour < 20) {
      session = 'After-Hours';
      sessionColor = 'text-amber';
    }
  }

  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-6 px-6 py-3 bg-bg-1 border-b border-line sticky top-0 z-50 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 border-[1.5px] border-amber grid place-items-center relative">
          <div className="absolute inset-1 border border-amber-dim" />
          <span className="font-serif text-sm font-black text-amber-bright">S</span>
        </div>
        <div className="flex flex-col leading-tight">
          <div className="font-serif text-base font-bold text-text-0">Schwabach's Market</div>
          <div className="text-[9px] tracking-[0.2em] text-text-2 uppercase">
            Intraday Intelligence Terminal
          </div>
        </div>
      </div>

      <div className="text-center text-text-2 text-[10px] tracking-[0.15em] uppercase">
        {quote ? (
          <span>
            Active: <span className="text-text-0 font-bold">{quote.symbol}</span>
            <span className={`ml-3 ${quote.change >= 0 ? 'text-green' : 'text-red'}`}>
              ${quote.price?.toFixed(2)} ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent?.toFixed(2)}%)
            </span>
          </span>
        ) : (
          <span>Select a symbol or search above</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Ticker search */}
        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="AAPL, BTCUSDT…"
            className="bg-bg-2 border border-line px-3 py-1.5 text-[11px] text-text-0 focus:outline-none focus:border-amber-dim w-32 placeholder-text-3"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-amber text-bg-0 text-[10px] font-bold tracking-[0.1em] uppercase hover:bg-amber-bright transition-colors"
          >
            Go
          </button>
        </form>

        <div className={`flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase ${sessionColor}`}>
          <span className={`w-2 h-2 rounded-full pulse-glow ${session.includes('Open') ? 'bg-green shadow-[0_0_12px_var(--green)]' : 'bg-text-2'}`} />
          <span>{session}</span>
        </div>
        <div className="text-amber-bright font-semibold tracking-wider">{time}</div>
      </div>
    </header>
  );
}
