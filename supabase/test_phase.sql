-- Run in Supabase Dashboard → SQL Editor → New Query
-- Toggle test phase: set value to 'true' to enable, 'false' to disable
insert into app_settings (key, value) values ('test_phase', 'false')
  on conflict (key) do nothing;

-- To enable:  update app_settings set value = 'true'  where key = 'test_phase';
-- To disable: update app_settings set value = 'false' where key = 'test_phase';
