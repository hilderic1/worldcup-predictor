-- Run in Supabase Dashboard → SQL Editor → New Query
-- Creates the team_strengths table and seeds it with WC 2026 pre-tournament data.
-- For a new tournament: truncate the table and re-insert with new values,
-- OR update individual rows via the Admin → Strengths panel in the app.

create table if not exists team_strengths (
  team_name    text primary key,
  fifa_rank    int,
  opta_win_pct numeric(6, 3)
);

-- Seed with WC 2026 values (FIFA April 2026 + Opta Supercomputer pre-tournament)
insert into team_strengths (team_name, fifa_rank, opta_win_pct) values
  ('France',                 1,  12.760),
  ('Spain',                  2,  16.040),
  ('Argentina',              3,  10.350),
  ('England',                4,  11.360),
  ('Portugal',               5,   6.820),
  ('Brazil',                 6,   6.450),
  ('Netherlands',            7,   3.800),
  ('Morocco',                8,   1.820),
  ('Belgium',                9,   2.460),
  ('Germany',               10,   5.430),
  ('Croatia',               11,   1.500),
  ('Colombia',              13,   2.030),
  ('Senegal',               14,   0.910),
  ('Mexico',                15,   0.960),
  ('United States',         16,   1.400),
  ('Uruguay',               17,   1.660),
  ('Japan',                 18,   1.400),
  ('Switzerland',           19,   1.470),
  ('Iran',                  21,   0.200),
  ('Türkiye',               22,   1.030),
  ('Ecuador',               23,   1.580),
  ('Austria',               24,   0.530),
  ('South Korea',           25,   0.390),
  ('Australia',             27,   0.380),
  ('Algeria',               28,   0.240),
  ('Egypt',                 29,   0.330),
  ('Canada',                30,   0.440),
  ('Norway',                31,   3.360),
  ('Panama',                33,   0.090),
  ('Ivory Coast',           34,   0.200),
  ('Sweden',                38,   0.470),
  ('Paraguay',              40,   0.530),
  ('Czechia',               41,   0.300),
  ('Scotland',              43,   0.230),
  ('Tunisia',               44,   0.100),
  ('Congo DR',              46,   0.090),
  ('Uzbekistan',            50,   0.040),
  ('Qatar',                 55,   0.060),
  ('Iraq',                  57,   0.060),
  ('South Africa',          60,   0.060),
  ('Saudi Arabia',          61,   0.050),
  ('Jordan',                63,   0.040),
  ('Bosnia and Herzegovina',65,   0.240),
  ('Cape Verde',            69,   0.050),
  ('Ghana',                 74,   0.230),
  ('Curacao',               82,   0.000),
  ('Haiti',                 83,   0.000),
  ('New Zealand',           85,   0.070)
on conflict (team_name) do nothing;
