-- Sovereign Markets schema
-- Run this in your Supabase SQL editor

-- =========================
-- WATCHLIST
-- =========================
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  asset_type text not null default 'stock' check (asset_type in ('stock', 'etf', 'crypto', 'forex')),
  display_name text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists watchlist_user_idx on public.watchlist(user_id, position);

alter table public.watchlist enable row level security;

create policy "users read own watchlist"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "users insert own watchlist"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

create policy "users update own watchlist"
  on public.watchlist for update
  using (auth.uid() = user_id);

create policy "users delete own watchlist"
  on public.watchlist for delete
  using (auth.uid() = user_id);

-- =========================
-- TRADES (trade journal)
-- =========================
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('long', 'short')),
  entry_price numeric(18, 4) not null,
  exit_price numeric(18, 4),
  size numeric(18, 4) not null,
  entry_time timestamptz not null default now(),
  exit_time timestamptz,
  pnl numeric(18, 4) generated always as (
    case
      when exit_price is null then null
      when side = 'long' then (exit_price - entry_price) * size
      else (entry_price - exit_price) * size
    end
  ) stored,
  setup text,
  notes text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists trades_user_time_idx on public.trades(user_id, entry_time desc);
create index if not exists trades_user_setup_idx on public.trades(user_id, setup);

alter table public.trades enable row level security;

create policy "users read own trades"
  on public.trades for select
  using (auth.uid() = user_id);

create policy "users insert own trades"
  on public.trades for insert
  with check (auth.uid() = user_id);

create policy "users update own trades"
  on public.trades for update
  using (auth.uid() = user_id);

create policy "users delete own trades"
  on public.trades for delete
  using (auth.uid() = user_id);

-- =========================
-- ALERTS
-- =========================
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  alert_type text not null check (alert_type in ('price_above', 'price_below', 'volume_spike', 'rsi_above', 'rsi_below', 'news', 'pattern')),
  threshold numeric(18, 4),
  message text,
  active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists alerts_user_active_idx on public.alerts(user_id, active);

alter table public.alerts enable row level security;

create policy "users read own alerts"
  on public.alerts for select
  using (auth.uid() = user_id);

create policy "users insert own alerts"
  on public.alerts for insert
  with check (auth.uid() = user_id);

create policy "users update own alerts"
  on public.alerts for update
  using (auth.uid() = user_id);

create policy "users delete own alerts"
  on public.alerts for delete
  using (auth.uid() = user_id);

-- =========================
-- SIGNAL CACHE
-- caches AI signals to avoid re-spending tokens on identical chart states
-- =========================
create table if not exists public.signal_cache (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  state_hash text not null,
  signal_text text not null,
  tags jsonb,
  levels jsonb,
  created_at timestamptz not null default now(),
  unique (symbol, state_hash)
);

create index if not exists signal_cache_lookup_idx on public.signal_cache(symbol, state_hash);

-- public read on cache (it's not user-specific data)
alter table public.signal_cache enable row level security;
create policy "anyone read cache"
  on public.signal_cache for select
  using (true);

-- =========================
-- SEED DEFAULT WATCHLIST FOR NEW USERS
-- =========================
create or replace function public.seed_default_watchlist()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.watchlist (user_id, symbol, asset_type, display_name, position) values
    (new.id, 'SPY', 'etf', 'S&P 500 ETF', 0),
    (new.id, 'QQQ', 'etf', 'Nasdaq 100 ETF', 1),
    (new.id, 'NVDA', 'stock', 'NVIDIA', 2),
    (new.id, 'TSLA', 'stock', 'Tesla', 3),
    (new.id, 'AAPL', 'stock', 'Apple', 4),
    (new.id, 'AMD', 'stock', 'AMD', 5),
    (new.id, 'META', 'stock', 'Meta', 6),
    (new.id, 'BTCUSDT', 'crypto', 'Bitcoin', 7)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed on auth.users;
create trigger on_auth_user_created_seed
  after insert on auth.users
  for each row execute procedure public.seed_default_watchlist();
