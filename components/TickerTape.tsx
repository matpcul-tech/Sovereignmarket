'use client';

export default function TickerTape({
  quotes,
  watchlist,
}: {
  quotes: Record<string, any>;
  watchlist: any[];
}) {
  const items = watchlist
    .map((w) => quotes[w.symbol])
    .filter(Boolean)
    .filter((q) => q.price > 0);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div className="bg-bg-2 border-b border-line overflow-hidden">
      <div
        className="flex gap-7 py-2 whitespace-nowrap scroll-tape"
        style={{ width: 'max-content' }}
      >
        {doubled.map((q, i) => (
          <span key={`${q.symbol}-${i}`} className="inline-flex gap-1.5 items-baseline text-[11px] px-2">
            <span className="text-text-1 font-semibold">{q.symbol}</span>
            <span className="text-text-0">${q.price.toFixed(2)}</span>
            <span className={q.change >= 0 ? 'text-green' : 'text-red'}>
              {q.changePercent >= 0 ? '+' : ''}
              {q.changePercent.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
