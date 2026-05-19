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

    // Check cache
    const supabase = createClient();
    const { data: cached } = await supabase
      .from('signal_cache')
      .select('*')
      .eq('symbol', symbol)
      .eq('state_hash', stateHash)
      .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
      .single();

    if (cached) {
      return NextResponse.json({
        signal: cached.signal_text,
        tags: cached.tags,
        levels: cached.levels,
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

    const prompt = `You are an experienced day trader providing technical analysis. Read the chart state below and produce a concise market-structure read.

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
  "signal": "2-3 sentence read of what is happening on the chart. Reference specific price levels, VWAP relationship, momentum, volume context. Use trader vocabulary (reclaim, rejection, flag, breakout, range, etc). Do NOT give buy/sell recommendations - describe the setup only.",
  "tags": ["tag1", "tag2", "tag3"],
  "levels": {
    "support": <number - nearest key support price>,
    "resistance": <number - nearest key resistance price>,
    "target": <number - logical measured-move target if setup plays out>
  }
}

Tags should be from this set: Breakout, Breakdown, VWAP Hold, VWAP Reject, Bull Flag, Bear Flag, Range, Trend Day, Mean Revert, Volume Surge, Overextended, Consolidation, News Catalyst, Failed Breakout, Reclaim, Rejection.

Do not predict direction. Describe what IS, not what WILL be. Be precise about levels.`;

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

    // Cache it
    await supabase.from('signal_cache').upsert({
      symbol,
      state_hash: stateHash,
      signal_text: parsed.signal,
      tags: parsed.tags,
      levels: parsed.levels,
    });

    return NextResponse.json({
      signal: parsed.signal,
      tags: parsed.tags,
      levels: parsed.levels,
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
