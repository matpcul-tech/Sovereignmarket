'use client';

import { useEffect, useState } from 'react';

export default function NewsFeed({ watchlistSymbols }: { watchlistSymbols: string[] }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const stockSymbols = watchlistSymbols.filter((s) => !s.includes('USDT'));
        const params = stockSymbols.length > 0 ? `?symbols=${stockSymbols.join(',')}` : '';
        const r = await fetch(`/api/news${params}`);
        const data = await r.json();
        if (!data.error) setArticles(data.articles || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [watchlistSymbols.join(',')]);

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="border-b border-line bg-bg-1 flex-1">
      <div className="flex justify-between items-center px-3.5 py-2.5 bg-bg-2 border-b border-line">
        <div className="text-[9px] tracking-[0.25em] uppercase text-amber-dim font-bold flex items-center gap-2">
          <span className="text-amber text-[8px]">▸</span>
          News &amp; Catalysts
        </div>
        <div className="text-[9px] text-text-2 tracking-wider">
          {loading ? 'Loading…' : `${articles.length} items`}
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {articles.length === 0 && !loading && (
          <div className="px-3.5 py-6 text-center text-text-2 text-[10px]">
            No news available
          </div>
        )}
        {articles.map((n) => (
          <a
            key={n.id}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3.5 py-2.5 border-b border-line hover:bg-bg-2 transition-colors"
          >
            <div className="flex justify-between mb-1 text-[9px] tracking-wider uppercase">
              <span className="text-amber-dim font-semibold flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    n.sentiment === 'pos'
                      ? 'bg-green'
                      : n.sentiment === 'neg'
                      ? 'bg-red'
                      : 'bg-text-2'
                  }`}
                />
                {n.source}
              </span>
              <span className="text-text-2">{timeAgo(n.datetime)}</span>
            </div>
            <div className="text-[11px] leading-snug text-text-0 font-medium line-clamp-2">
              {n.headline}
            </div>
            {n.tickers && n.tickers.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {n.tickers.slice(0, 4).map((t: string) => (
                  <span
                    key={t}
                    className="text-[9px] px-1.5 py-0.5 bg-bg-3 text-text-1 border border-line"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
