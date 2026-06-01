-- Run this in Supabase Dashboard → SQL Editor → New Query
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  to_player text references players(name),
  body text not null,
  created_at timestamptz default now(),
  read boolean default false
);
alter table messages enable row level security;
create policy "allow all" on messages for all using (true) with check (true);
