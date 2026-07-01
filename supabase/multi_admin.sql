-- Run in Supabase Dashboard → SQL Editor → New Query

-- 1. Add linked_player column to players
alter table players add column if not exists linked_player text;

-- 2. Link the existing Admin account to a player (edit as needed)
-- update players set linked_player = 'David' where name = 'Admin';

-- 3. To make a player also an admin (e.g. give Hilde admin rights linked to herself):
-- update players set is_admin = true, linked_player = 'Hilde' where name = 'Hilde';

-- 4. To add a brand-new admin account linked to a player:
-- insert into players (name, password_hash, is_admin, linked_player)
--   values ('AdminDavid', 'chooseapassword', true, 'David')
--   on conflict (name) do nothing;
