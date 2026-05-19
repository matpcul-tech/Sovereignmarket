# Sovereign Markets

Intraday Intelligence Terminal — AI-powered day trading insights and chart analysis.

A Sovereign Shield Technologies product.

## What's in here

A complete Next.js 14 + Supabase trading app with:

- **Market scanner** — gappers, volume leaders, breakouts (Finnhub)
- **Multi-asset charts** — stocks, ETFs, crypto with 15min-delayed quotes
- **Technical indicators** — VWAP, EMA 9/20/50, RSI, MACD, ATR computed client-side
- **Sovereign Signal** — Claude reads the chart state and produces trader-style interpretation with key levels
- **News feed** — filtered by your watchlist with keyword sentiment
- **Trade journal** — auto-computed P/L, win rate, best-setup analytics
- **Magic-link auth** with Supabase + RLS on all tables

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create accounts and grab API keys

- **Supabase**: create a new project at https://supabase.com → Settings → API → copy URL, anon key, service role key
- **Finnhub**: free account at https://finnhub.io → API key (60 calls/min)
- **Alpha Vantage**: free key at https://www.alphavantage.co/support/#api-key (25 calls/day)
- **Anthropic**: use your existing key from console.anthropic.com

### 3. Configure environment

Copy `.env.local.example` to `.env.local` and fill in your keys.

### 4. Run the database schema

Open your Supabase project → SQL editor → paste contents of `supabase/schema.sql` → run.

This creates:
- `watchlist` table with RLS
- `trades` table with computed pnl column
- `alerts` table
- `signal_cache` for AI signal caching
- Trigger that seeds a default watchlist for new users

### 5. Configure Supabase auth

- Authentication → Email Templates → make sure magic link is enabled
- Authentication → URL Configuration → add your dev and production redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://your-domain.vercel.app/auth/callback`
- Authentication → SMTP Settings → configure Resend (or default Supabase SMTP for testing)

### 6. Run dev server

```bash
npm run dev
```

Open http://localhost:3000 — you'll get redirected to login.

## Deploying to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Add all env vars from `.env.local`
4. Add the production callback URL to Supabase
5. Deploy

## Data feed notes

The app is built for **15-minute delayed equity data** on free API tiers:

- **Stocks/ETFs**: Finnhub quotes (real-time but free tier limited) + Alpha Vantage intraday candles
- **Crypto**: Binance public API — real-time, unlimited, no key needed
- **Alpha Vantage limit**: 25 calls/day on free tier — candles cached 60s

To upgrade to real-time equities later: swap Alpha Vantage candle fetch for Polygon.io ($30/mo starter) or Tradier (free if you have a brokerage account).

## Architecture

```
app/
  api/
    quote/      → live quote (Finnhub stocks, Binance crypto)
    candles/    → OHLC bars for charting
    scanner/    → gappers, volume, breakouts
    news/       → company and market news
    signal/     → Claude AI interpretation with caching
  auth/callback → magic-link PKCE exchange
  dashboard/    → main terminal page (server component)
  login/        → magic-link entry

components/
  Terminal.tsx       → main client orchestrator
  TopBar.tsx         → brand, clock, session status
  TickerTape.tsx     → scrolling watchlist quotes
  Scanner.tsx        → tabbed market scanner
  Watchlist.tsx      → add/remove symbols, live quotes
  PriceChart.tsx     → Chart.js price + indicators
  SignalPanel.tsx    → AI signal display
  NewsFeed.tsx       → filtered news with sentiment
  TradeJournal.tsx   → log trades, see stats

lib/
  indicators.ts      → EMA, VWAP, RSI, MACD, ATR
  supabase-server.ts → SSR Supabase client
  supabase-browser.ts → browser Supabase client

supabase/schema.sql  → full database schema with RLS
```

## Standing rule

This app provides **technical analysis and market structure context**, not investment advice. The Sovereign Signal layer describes what is happening on the chart in trader vocabulary. It does not predict direction and does not tell you to buy or sell. Trading decisions are yours.
