export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Exponential Moving Average
export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

// Simple Moving Average
export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return out;
}

// Volume Weighted Average Price (intraday, resets daily)
export function vwap(candles: Candle[]): number[] {
  const out: number[] = [];
  let cumPV = 0;
  let cumV = 0;
  let lastDay = -1;

  for (const c of candles) {
    const day = new Date(c.time).getUTCDate();
    if (day !== lastDay) {
      cumPV = 0;
      cumV = 0;
      lastDay = day;
    }
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumV += c.volume;
    out.push(cumV > 0 ? cumPV / cumV : c.close);
  }
  return out;
}

// Relative Strength Index
export function rsi(values: number[], period: number = 14): number[] {
  const out: number[] = [];
  if (values.length < period + 1) return values.map(() => NaN);

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      out.push(NaN);
      continue;
    }
    if (i > period) {
      const diff = values[i] - values[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
}

// MACD
export function macd(
  values: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

// Average True Range
export function atr(candles: Candle[], period: number = 14): number[] {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
      continue;
    }
    const c = candles[i];
    const prev = candles[i - 1];
    tr.push(Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    ));
  }
  // Wilder's smoothing
  const out: number[] = [];
  let avg = 0;
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    if (i === period - 1) {
      avg = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      avg = (avg * (period - 1) + tr[i]) / period;
    }
    out.push(avg);
  }
  return out;
}

// Last finite value helper
export function last<T>(arr: T[]): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (typeof arr[i] === 'number' && !isNaN(arr[i] as number)) return arr[i];
    if (typeof arr[i] !== 'number') return arr[i];
  }
  return arr[arr.length - 1];
}
