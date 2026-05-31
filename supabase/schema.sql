-- ============================================================
-- World Cup Predictor 2026 — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Players table (pre-seeded, no open registration)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  password_hash text not null,  -- stored as plain text for simplicity (bcrypt not needed for a hobby app)
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Match predictions (one row per player per match)
create table if not exists match_predictions (
  id uuid primary key default gen_random_uuid(),
  player_name text references players(name),
  match_id text not null,
  home_score integer,
  away_score integer,
  updated_at timestamptz default now(),
  unique(player_name, match_id)
);

-- Group ranking predictions (one row per player per group)
create table if not exists group_ranking_predictions (
  id uuid primary key default gen_random_uuid(),
  player_name text references players(name),
  group_id text not null,
  ranking text[] not null,  -- array of team names in order [1st, 2nd, 3rd, 4th]
  updated_at timestamptz default now(),
  unique(player_name, group_id)
);

-- Knockout picks (one row per player per round)
create table if not exists knockout_predictions (
  id uuid primary key default gen_random_uuid(),
  player_name text references players(name),
  round text not null,
  teams text[] not null,
  updated_at timestamptz default now(),
  unique(player_name, round)
);

-- Actual results (admin-only writes)
create table if not exists actual_results (
  id uuid primary key default gen_random_uuid(),
  match_id text unique not null,
  home_score integer,
  away_score integer,
  updated_at timestamptz default now()
);

create table if not exists actual_group_rankings (
  id uuid primary key default gen_random_uuid(),
  group_id text unique not null,
  ranking text[] not null,
  updated_at timestamptz default now()
);

create table if not exists actual_knockout (
  id uuid primary key default gen_random_uuid(),
  round text unique not null,
  teams text[] not null,
  updated_at timestamptz default now()
);

-- App settings (deadline, etc.)
create table if not exists app_settings (
  key text primary key,
  value text
);

insert into app_settings (key, value) values ('deadline', null) on conflict do nothing;

-- ============================================================
-- SEED PLAYERS (change passwords as needed!)
-- ============================================================
insert into players (name, password_hash, is_admin) values
  ('David',   'david123',   false),
  ('Dorian',  'dorian123',  false),
  ('Antonia', 'antonia123', false),
  ('Irma',    'irma123',    false),
  ('Laura',   'laura123',   false),
  ('Dorus',   'dorus123',   false),
  ('Sandra',  'sandra123',  false),
  ('Hilde',   'hilde123',   false),
  ('Eric',    'eric123',    false),
  ('Claude',  'claude123',  false),
  ('Admin',   'admin2026!', true)
on conflict (name) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY (important for privacy!)
-- ============================================================

alter table players enable row level security;
alter table match_predictions enable row level security;
alter table group_ranking_predictions enable row level security;
alter table knockout_predictions enable row level security;
alter table actual_results enable row level security;
alter table actual_group_rankings enable row level security;
alter table actual_knockout enable row level security;
alter table app_settings enable row level security;

-- Allow all reads/writes via service role (the app uses anon key with RLS bypassed via policies below)
-- For simplicity we allow anon access — the app handles auth logic itself

create policy "allow all" on players for all using (true) with check (true);
create policy "allow all" on match_predictions for all using (true) with check (true);
create policy "allow all" on group_ranking_predictions for all using (true) with check (true);
create policy "allow all" on knockout_predictions for all using (true) with check (true);
create policy "allow all" on actual_results for all using (true) with check (true);
create policy "allow all" on actual_group_rankings for all using (true) with check (true);
create policy "allow all" on actual_knockout for all using (true) with check (true);
create policy "allow all" on app_settings for all using (true) with check (true);
