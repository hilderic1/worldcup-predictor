-- Run in Supabase Dashboard → SQL Editor → New Query
alter table players add column if not exists last_login timestamptz;
