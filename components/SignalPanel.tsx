'use client';

export default function SignalPanel({
  signal,
  loading,
  onRegenerate,
}: {
  signal: any;
  loading: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="bg-gradient-to-b from-bg-1 to-bg-2 border border-line-bright relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber to-transparent" />

      <div className="flex items-center justify-between px-3.5 py-3 border-b border-line">
        <div className="flex items-center gap-2 text-[9px] tracking-[0.25em] uppercase text-amber-bright font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-bright to-amber-dim orb-pulse" />
          Sovereign Signal
        </div>
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="text-[9px] tracking-wider text-text-2 hover:text-amber-bright transition-colors disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : '↻ Refresh'}
        </button>
      </div>

      <div className="p-4">
        {loading && !signal ? (
          <div className="text-text-2 text-xs italic">Reading chart state…</div>
        ) : signal ? (
          <>
            <div
              className="font-serif text-sm leading-relaxed text-text-0 mb-3 font-medium"
              dangerouslySetInnerHTML={{ __html: signal.signal }}
            />

            {signal.tags && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {signal.tags.map((t: string, i: number) => (
                  <span
                    key={i}
                    className="text-[9px] px-2 py-0.5 bg-bg-3 border border-line-bright text-text-1 tracking-wider"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {signal.levels && (
              <div className="grid grid-cols-3 gap-px bg-line mt-2">
                <LevelCell label="Support" value={signal.levels.support} color="text-green" />
                <LevelCell label="Resistance" value={signal.levels.resistance} color="text-red" />
                <LevelCell label="Target" value={signal.levels.target} color="text-amber-bright" />
              </div>
            )}

            {signal.cached && (
              <div className="mt-3 text-[8px] tracking-wider text-text-3 uppercase">
                Cached · Same state
              </div>
            )}
          </>
        ) : (
          <div className="text-text-2 text-xs italic">
            Select a symbol with data to generate a signal.
          </div>
        )}
      </div>
    </div>
  );
}

function LevelCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-bg-2 p-2 text-center">
      <div className="text-[8px] tracking-[0.15em] uppercase text-text-2 mb-0.5">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${color}`}>
        ${typeof value === 'number' ? value.toFixed(2) : '--'}
      </div>
    </div>
  );
}
