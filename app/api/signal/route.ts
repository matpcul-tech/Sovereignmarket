import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SignalRequest {
  symbol: string;
  price: number;
  changePercent: number;
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  indicators: {
    rsi?: number;
    vwap?: number;
    ema9?: number;
    ema20?: number;
    ema50?: number;
    atr?: number;
    avgVolume?: number;
    currentVolume?: number;
  };
  news?: Array<{ headline: string; source: string; datetime: number }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: SignalRequest = await req.json();
    const { symbol, price, indicators, candles } = body;

    if (!symbol || !candles || candles.length < 5) {
      return NextResponse.json({ error: 'insufficient data' }, { status: 400 });
    }

    // State hash - cache identical chart states
    const stateHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        symbol,
        price: Math.round(price * 100) / 100,
        rsi: Math.round((indicators.rsi || 0) * 10) / 10,
        vwap: Math.round((indicators.vwap || 0) * 100) / 100,
        ema9: Math.round((indicators.ema9 || 0) * 100) / 100,
        lastCandleTime: candles[candles.length - 1]?.time,
      }))
      .digest('hex')
      .slice(0, 16);

    // Check cache (best-effort — table may not exist yet)
    let cachedRow: any = null;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('signal_cache')
        .select('*')
        .eq('symbol', symbol)
        .eq('state_hash', stateHash)
        .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
        .single();
      cachedRow = data;
    } catch {}

    if (cachedRow) {
      const lv = cachedRow.levels || {};
      return NextResponse.json({
        signal: cachedRow.signal_text,
        tags: cachedRow.tags,
        action: lv.action,
        conviction: lv.conviction,
        levels: { entry: lv.entry, stop: lv.stop, target: lv.target },
        cached: true,
      });
    }

    // Build the analysis prompt
    const recent = candles.slice(-20);
    const last = recent[recent.length - 1];
    const sessionHigh = Math.max(...recent.map((c) => c.high));
    const sessionLow = Math.min(...recent.map((c) => c.low));
    const trendUp = recent.filter((c) => c.close > c.open).length;
    const trendDown = recent.filter((c) => c.close < c.open).length;

    const prompt = `You are an experienced day trader generating an actionable trade pick. Read the chart state below and return a specific call: long, short, or stand aside. Be decisive.

SYMBOL: ${symbol}
CURRENT PRICE: $${price.toFixed(2)}
SESSION CHANGE: ${body.changePercent > 0 ? '+' : ''}${body.changePercent.toFixed(2)}%

RECENT 15-MIN CANDLES (last 20):
Session high: $${sessionHigh.toFixed(2)}
Session low: $${sessionLow.toFixed(2)}
Last candle: O $${last.open.toFixed(2)} H $${last.high.toFixed(2)} L $${last.low.toFixed(2)} C $${last.close.toFixed(2)}
Bullish candles: ${trendUp} / Bearish: ${trendDown}

INDICATORS:
${indicators.vwap ? `VWAP: $${indicators.vwap.toFixed(2)} (price is ${price > indicators.vwap ? 'ABOVE' : 'BELOW'} VWAP)` : ''}
${indicators.rsi ? `RSI(14): ${indicators.rsi.toFixed(1)} (${indicators.rsi > 70 ? 'overbought' : indicators.rsi < 30 ? 'oversold' : 'neutral zone'})` : ''}
${indicators.ema9 ? `EMA 9: $${indicators.ema9.toFixed(2)}` : ''}
${indicators.ema20 ? `EMA 20: $${indicators.ema20.toFixed(2)}` : ''}
${indicators.atr ? `ATR(14): $${indicators.atr.toFixed(2)}` : ''}

${body.news && body.news.length > 0 ? `RECENT NEWS:\n${body.news.slice(0, 3).map((n) => `- ${n.headline} (${n.source})`).join('\n')}` : ''}

OUTPUT FORMAT - respond with valid JSON only, no markdown, no preamble:
{
  "action": "LONG" | "SHORT" | "WAIT",
  "conviction": "LOW" | "MEDIUM" | "HIGH",
  "entry": <number - exact price to enter at, or 0 if action is WAIT>,
  "stop": <number - price where the thesis is invalidated and you exit, or 0 if WAIT>,
  "target": <number - first realistic profit target based on measured move or next key level, or 0 if WAIT>,
  "signal": "3-4 sentence plain-English explanation. Lead with WHY this is the trade (or why to wait). Reference the specific levels, VWAP relationship, momentum, and volume. End with what would invalidate the thesis. Write like you're telling a friend - no robotic phrasing.",
  "tags": ["tag1", "tag2", "tag3"]
}

DECISION RULES:
- LONG only when momentum aligns (price above VWAP + bullish structure + RSI not overbought) OR a clean reversal off oversold
- SHORT only when momentum aligns down (price below VWAP + bearish structure + RSI not oversold) OR a clean rejection at resistance
- WAIT when the chart is chop, mid-range, or signals conflict. It is BETTER to wait than to force a trade.
- Conviction HIGH only when 4+ signals align. MEDIUM when 2-3 align. LOW when the setup is marginal but tradeable.
- Reward-to-risk on the trade (|target - entry| / |entry - stop|) MUST be >= 1.5 or you must return WAIT.
- Stops should respect ATR - tighter than 0.5x ATR will get stopped on noise, wider than 2x ATR is poor R:R.

Tags should be from this set: Breakout, Breakdown, VWAP Hold, VWAP Reject, Bull Flag, Bear Flag, Range, Trend Day, Mean Revert, Volume Surge, Overextended, Consolidation, News Catalyst, Failed Breakout, Reclaim, Rejection, Chop, Wait Setup.

Be decisive. A clear WAIT is more valuable than a forced LONG.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Strip any code fences just in case
    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Cache it (best-effort — don't let a failed upsert discard the signal)
    try {
      const supabase = createClient();
      await supabase.from('signal_cache').upsert({
        symbol,
        state_hash: stateHash,
        signal_text: parsed.signal,
        tags: parsed.tags,
        levels: {
          action: parsed.action,
          conviction: parsed.conviction,
          entry: parsed.entry,
          stop: parsed.stop,
          target: parsed.target,
        },
      });
    } catch {}

    return NextResponse.json({
      signal: parsed.signal,
      tags: parsed.tags,
      action: parsed.action,
      conviction: parsed.conviction,
      levels: {
        entry: parsed.entry,
        stop: parsed.stop,
        target: parsed.target,
      },
      cached: false,
    });
  } catch (err: any) {
    console.error('Signal error:', err);
    return NextResponse.json(
      { error: err.message || 'signal generation failed' },
      { status: 500 }
    );
  }
}
