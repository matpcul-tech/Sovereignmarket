'use client';

import { useEffect, useRef } from 'react';
import { Candle, ema, vwap } from '@/lib/indicators';

export default function PriceChart({
  symbol,
  displayName,
  quote,
  candles,
  indicators,
  resolution,
  onResolutionChange,
  loading,
}: {
  symbol: string;
  displayName: string;
  quote: any;
  candles: Candle[];
  indicators: any;
  resolution: string;
  onResolutionChange: (r: string) => void;
  loading: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || candles.length === 0) return;
    let Chart: any;

    (async () => {
      const mod = await import('chart.js/auto');
      Chart = mod.default;

      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const closes = candles.map((c) => c.close);
      const labels = candles.map((c) => {
        const d = new Date(c.time);
        return d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'America/New_York',
        });
      });
      const vwapData = vwap(candles);
      const ema9Data = ema(closes, 9);
      const ema20Data = ema(closes, 20);

      chartRef.current = new Chart(canvasRef.current!.getContext('2d')!, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Price',
              data: closes,
              borderColor: '#e8e6dc',
              backgroundColor: 'rgba(212, 160, 23, 0.06)',
              borderWidth: 2,
              fill: true,
              tension: 0.2,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: '#f5c542',
            },
            {
              label: 'EMA 9',
              data: ema9Data,
              borderColor: '#4fc3f7',
              borderWidth: 1.2,
              fill: false,
              tension: 0.3,
              pointRadius: 0,
            },
            {
              label: 'EMA 20',
              data: ema20Data,
              borderColor: '#b388ff',
              borderWidth: 1.2,
              fill: false,
              tension: 0.3,
              pointRadius: 0,
            },
            {
              label: 'VWAP',
              data: vwapData,
              borderColor: '#d4a017',
              borderWidth: 1.5,
              fill: false,
              tension: 0.1,
              pointRadius: 0,
              borderDash: [4, 4],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#11140f',
              borderColor: '#2e3a1e',
              borderWidth: 1,
              titleColor: '#f5c542',
              bodyColor: '#e8e6dc',
              titleFont: { family: 'JetBrains Mono', size: 11 },
              bodyFont: { family: 'JetBrains Mono', size: 11 },
              padding: 12,
              cornerRadius: 0,
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(31, 36, 24, 0.5)' },
              ticks: {
                color: '#76735f',
                font: { family: 'JetBrains Mono', size: 9 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8,
              },
            },
            y: {
              position: 'right',
              grid: { color: 'rgba(31, 36, 24, 0.5)' },
              ticks: {
                color: '#76735f',
                font: { family: 'JetBrains Mono', size: 9 },
                callback: (v: any) => '$' + Number(v).toFixed(2),
              },
            },
          },
        },
      });
    })();

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [candles, symbol]);

  const timeframes = [
    { label: '1m', value: '1' },
    { label: '5m', value: '5' },
    { label: '15m', value: '15' },
    { label: '1h', value: '60' },
    { label: '1d', value: 'D' },
  ];

  const avgVol = candles.length > 0
    ? candles.reduce((a, c) => a + c.volume, 0) / candles.length
    : 0;
  const lastVol = candles[candles.length - 1]?.volume || 0;
  const volRatio = avgVol > 0 ? (lastVol / avgVol).toFixed(1) : '--';

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 bg-bg-1 border-b border-line">
        <div className="flex items-baseline gap-4">
          <div className="font-serif text-3xl font-extrabold text-text-0 tracking-tight leading-none">
            {symbol || '—'}
          </div>
          <div className="text-text-2 text-[11px] tracking-wider uppercase">
            {displayName}
          </div>
        </div>
        <div className="flex items-baseline gap-3">
          {quote ? (
            <>
              <div className="text-3xl font-bold text-text-0 tabular-nums">
                ${quote.price < 1 ? quote.price.toFixed(4) : quote.price.toFixed(2)}
              </div>
              <div className="flex flex-col text-sm font-semibold leading-tight">
                <span className={quote.change >= 0 ? 'text-green' : 'text-red'}>
                  {quote.change >= 0 ? '+' : ''}${quote.change?.toFixed(2)}
                </span>
                <span className={quote.change >= 0 ? 'text-green' : 'text-red'}>
                  {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent?.toFixed(2)}%
                </span>
              </div>
            </>
          ) : (
            <div className="text-text-3 text-sm">{loading ? 'Loading…' : 'No data'}</div>
          )}
        </div>
      </div>

      <div className="flex gap-6 px-6 py-3 bg-bg-1 border-b border-line items-center">
        <div className="flex gap-0.5">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onResolutionChange(tf.value)}
              className={`px-3 py-1.5 border text-[10px] tracking-[0.1em] uppercase transition-all ${
                resolution === tf.value
                  ? 'bg-amber text-bg-0 border-amber font-bold'
                  : 'bg-bg-2 text-text-1 border-line hover:text-text-0 hover:border-line-bright'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-4 text-[10px] tracking-[0.1em] uppercase">
          <div className="text-text-0 flex items-center gap-1.5"><span className="w-2 h-2 bg-[#e8e6dc]" />Price</div>
          <div className="text-text-0 flex items-center gap-1.5"><span className="w-2 h-2 bg-[#4fc3f7]" />EMA 9</div>
          <div className="text-text-0 flex items-center gap-1.5"><span className="w-2 h-2 bg-[#b388ff]" />EMA 20</div>
          <div className="text-text-0 flex items-center gap-1.5"><span className="w-2 h-2 bg-amber" />VWAP</div>
        </div>
      </div>

      <div className="bg-bg-0 px-6 py-5 relative" style={{ minHeight: '380px' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '360px', display: candles.length > 0 ? 'block' : 'none' }} />
        {candles.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2">
            {loading ? (
              <div className="text-text-2 text-[11px] tracking-[0.15em] uppercase animate-pulse">
                Loading chart…
              </div>
            ) : (
              <>
                <div className="text-text-2 text-[11px] tracking-[0.15em] uppercase">
                  No chart data for {resolution === '1' ? '1m' : resolution === '5' ? '5m' : resolution === '15' ? '15m' : resolution === '60' ? '1h' : '1d'} resolution
                </div>
                <div className="text-text-3 text-[10px]">
                  {symbol ? 'Market may be closed · Try 15M or 1D' : 'Select a symbol to load chart'}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-6 gap-px bg-line border-t border-line">
        <IndiCell
          label="RSI 14"
          value={indicators.rsi?.toFixed(1) || '--'}
          note={
            indicators.rsi == null
              ? ''
              : indicators.rsi > 70
              ? 'Overbought'
              : indicators.rsi < 30
              ? 'Oversold'
              : 'Neutral'
          }
          valueColor={
            indicators.rsi == null
              ? ''
              : indicators.rsi > 70
              ? 'text-red'
              : indicators.rsi < 30
              ? 'text-green'
              : 'text-text-0'
          }
        />
        <IndiCell
          label="MACD"
          value={indicators.macd != null ? indicators.macd.toFixed(2) : '--'}
          note={
            indicators.macd != null && indicators.macdSignal != null
              ? indicators.macd > indicators.macdSignal
                ? 'Above signal'
                : 'Below signal'
              : ''
          }
          valueColor={
            indicators.macd != null && indicators.macdSignal != null
              ? indicators.macd > indicators.macdSignal
                ? 'text-green'
                : 'text-red'
              : 'text-text-0'
          }
        />
        <IndiCell
          label="VWAP"
          value={indicators.vwap?.toFixed(2) || '--'}
          note={
            quote && indicators.vwap
              ? quote.price > indicators.vwap
                ? 'Price above'
                : 'Price below'
              : ''
          }
        />
        <IndiCell
          label="Volume"
          value={formatVol(lastVol)}
          note={`${volRatio}× session avg`}
        />
        <IndiCell
          label="ATR 14"
          value={indicators.atr?.toFixed(2) || '--'}
          note={
            indicators.atr && quote
              ? `${((indicators.atr / quote.price) * 100).toFixed(1)}% range`
              : ''
          }
        />
        <IndiCell
          label="Session"
          value={quote ? `$${(quote.high - quote.low).toFixed(2)}` : '--'}
          note={quote ? `H ${quote.high?.toFixed(2)} L ${quote.low?.toFixed(2)}` : ''}
        />
      </div>
    </div>
  );
}

function IndiCell({
  label,
  value,
  note,
  valueColor = 'text-text-0',
}: {
  label: string;
  value: string;
  note: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-bg-1 px-4 py-3">
      <div className="text-[9px] tracking-[0.15em] uppercase text-text-2 mb-1">{label}</div>
      <div className={`text-base font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[9px] text-text-2 mt-0.5">{note}</div>
    </div>
  );
}

function formatVol(v: number): string {
  if (!v) return '--';
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + 'B';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}
