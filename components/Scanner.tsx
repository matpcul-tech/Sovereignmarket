'use client';

import { useEffect, useState } from 'react';

export default function Scanner({ onSelectSymbol }: { onSelectSymbol: (sym: string) => void }) {
  const [type, setType] = useState<'gappers' | 'volume' | 'breakouts'>('gappers');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const r = await fetch(`/api/scanner?type=${type}`);
        const data = await r.json();
        if (data.error) {
          setError(true);
          setResults([]);
        } else {
          setResults(data.results || []);
        }
      } catch {
        setError(true);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [type]);

  return (
    <div className="border-b border-line bg-bg-1">
      <div className="flex justify-between items-center px-3.5 py-2.5 bg-bg-2 border-b border-line">
        <div className="text-[9px] tracking-[0.25em] uppercase text-amber-dim font-bold flex items-center gap-2">
          <span className="text-amber text-[8px]">▸</span>
          Market Scanner
        </div>
        <div className="text-[9px] text-text-2 tracking-wider">
          {loading ? 'Loading…' : error ? 'Error' : 'Live'}
        </div>
      </div>

      <div className="flex bg-bg-2 border-b border-line">
        {(['gappers', 'volume', 'breakouts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-2.5 px-2 text-[9px] tracking-[0.15em] uppercase border-r border-line last:border-r-0 transition-all ${
              type === t
                ? 'text-amber-bright bg-bg-1 shadow-[inset_0_-2px_0_var(--amber)]'
                : 'text-text-2 hover:text-text-1'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="max-h-72 overflow-y-auto">
        {loading && results.length === 0 && (
          <div className="px-3.5 py-6 text-center text-text-2 text-[10px]">Loading…</div>
        )}
        {!loading && error && (
          <div className="px-3.5 py-6 text-center text-text-2 text-[10px]">
            Data unavailable — check API key
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <div className="px-3.5 py-6 text-center text-text-2 text-[10px]">No results</div>
        )}
        {results.map((r) => (
          <div
            key={r.symbol}
            onClick={() => onSelectSymbol(r.symbol)}
            className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3.5 py-2 border-b border-line cursor-pointer hover:bg-bg-2 transition-colors"
          >
            <div>
              <div className="text-text-0 font-bold text-[11px]">{r.symbol}</div>
              <div className="text-text-2 text-[10px]">{r.metric}</div>
            </div>
            <div className="text-right text-text-0 font-semibold text-[11px]">
              ${r.price?.toFixed(2)}
            </div>
            <span
              className={`text-[8px] px-1.5 py-0.5 tracking-wider uppercase border ${
                r.tag === 'gap'
                  ? 'border-amber-dim text-amber'
                  : r.tag === 'vol'
                  ? 'border-green-dim text-green'
                  : 'border-blue-700 text-blue-300'
              }`}
            >
              {r.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
