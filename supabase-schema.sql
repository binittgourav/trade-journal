create extension if not exists pgcrypto;

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_date date not null,
  instrument text not null,
  entry_time time not null,
  exit_time time not null,
  entry_price numeric(12, 2) not null,
  exit_price numeric(12, 2) not null,
  quantity numeric(12, 2) not null,
  strategy text not null,
  emotion_before text default '',
  emotion_during text default '',
  emotion_after text default '',
  stop_loss numeric(12, 2),
  target numeric(12, 2),
  planned_trade text check (planned_trade in ('Yes', 'No') or planned_trade is null),
  rating text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.trades
add column if not exists planned_trade text check (planned_trade in ('Yes', 'No') or planned_trade is null);

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

create table if not exists public.emotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

alter table public.trades enable row level security;
alter table public.strategies enable row level security;
alter table public.emotions enable row level security;

drop policy if exists "Users manage own trades" on public.trades;
create policy "Users manage own trades"
on public.trades
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own strategies" on public.strategies;
create policy "Users manage own strategies"
on public.strategies
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own emotions" on public.emotions;
create policy "Users manage own emotions"
on public.emotions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
