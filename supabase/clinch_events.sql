create table if not exists clinch_events (
  id          bigint generated always as identity primary key,
  group_id    text        not null,          -- "A" .. "L"
  team        text        not null,
  position    int         not null,          -- 1 or 2
  detected_at timestamptz not null default now(),
  unique (group_id, team, position)
);

-- Public read; only service-role can insert/delete
alter table clinch_events enable row level security;

create policy "anyone can read clinch events"
  on clinch_events for select using (true);

create policy "service role can manage clinch events"
  on clinch_events for all using (auth.role() = 'service_role');
