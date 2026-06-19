/**
 * Daily clinch detector — run by GitHub Actions at 06:00 Portugal time.
 * Computes which teams have mathematically clinched 1st or 2nd in their group,
 * compares against already-stored events, and inserts any new ones.
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Match data (mirrors src/constants.js) ─────────────────────────────────

const GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czechia"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Türkiye"],
  E: ["Germany", "Curacao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "Congo DR", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

const GROUP_MATCHES = [
  { id: "A1", group: "A", home: "Mexico",        away: "South Africa" },
  { id: "A2", group: "A", home: "South Korea",   away: "Czechia" },
  { id: "A3", group: "A", home: "South Africa",  away: "Czechia" },
  { id: "A4", group: "A", home: "Mexico",        away: "South Korea" },
  { id: "A5", group: "A", home: "Mexico",        away: "Czechia" },
  { id: "A6", group: "A", home: "South Africa",  away: "South Korea" },

  { id: "B1", group: "B", home: "Canada",                  away: "Bosnia and Herzegovina" },
  { id: "B2", group: "B", home: "Qatar",                   away: "Switzerland" },
  { id: "B3", group: "B", home: "Bosnia and Herzegovina",  away: "Switzerland" },
  { id: "B4", group: "B", home: "Canada",                  away: "Qatar" },
  { id: "B5", group: "B", home: "Canada",                  away: "Switzerland" },
  { id: "B6", group: "B", home: "Bosnia and Herzegovina",  away: "Qatar" },

  { id: "C1", group: "C", home: "Brazil",   away: "Morocco" },
  { id: "C2", group: "C", home: "Haiti",    away: "Scotland" },
  { id: "C3", group: "C", home: "Brazil",   away: "Haiti" },
  { id: "C4", group: "C", home: "Morocco",  away: "Scotland" },
  { id: "C5", group: "C", home: "Brazil",   away: "Scotland" },
  { id: "C6", group: "C", home: "Morocco",  away: "Haiti" },

  { id: "D1", group: "D", home: "United States", away: "Paraguay" },
  { id: "D2", group: "D", home: "Australia",     away: "Türkiye" },
  { id: "D3", group: "D", home: "Paraguay",      away: "Türkiye" },
  { id: "D4", group: "D", home: "United States", away: "Australia" },
  { id: "D5", group: "D", home: "United States", away: "Türkiye" },
  { id: "D6", group: "D", home: "Paraguay",      away: "Australia" },

  { id: "E1", group: "E", home: "Germany",      away: "Curacao" },
  { id: "E2", group: "E", home: "Ivory Coast",  away: "Ecuador" },
  { id: "E3", group: "E", home: "Germany",      away: "Ivory Coast" },
  { id: "E4", group: "E", home: "Curacao",      away: "Ecuador" },
  { id: "E5", group: "E", home: "Germany",      away: "Ecuador" },
  { id: "E6", group: "E", home: "Curacao",      away: "Ivory Coast" },

  { id: "F1", group: "F", home: "Netherlands",  away: "Japan" },
  { id: "F2", group: "F", home: "Sweden",       away: "Tunisia" },
  { id: "F3", group: "F", home: "Netherlands",  away: "Sweden" },
  { id: "F4", group: "F", home: "Japan",        away: "Tunisia" },
  { id: "F5", group: "F", home: "Netherlands",  away: "Tunisia" },
  { id: "F6", group: "F", home: "Japan",        away: "Sweden" },

  { id: "G1", group: "G", home: "Belgium",      away: "Egypt" },
  { id: "G2", group: "G", home: "Iran",         away: "New Zealand" },
  { id: "G3", group: "G", home: "Belgium",      away: "Iran" },
  { id: "G4", group: "G", home: "Egypt",        away: "New Zealand" },
  { id: "G5", group: "G", home: "Belgium",      away: "New Zealand" },
  { id: "G6", group: "G", home: "Egypt",        away: "Iran" },

  { id: "H1", group: "H", home: "Spain",        away: "Cape Verde" },
  { id: "H2", group: "H", home: "Saudi Arabia", away: "Uruguay" },
  { id: "H3", group: "H", home: "Spain",        away: "Saudi Arabia" },
  { id: "H4", group: "H", home: "Cape Verde",   away: "Uruguay" },
  { id: "H5", group: "H", home: "Spain",        away: "Uruguay" },
  { id: "H6", group: "H", home: "Cape Verde",   away: "Saudi Arabia" },

  { id: "I1", group: "I", home: "France",   away: "Senegal" },
  { id: "I2", group: "I", home: "Iraq",     away: "Norway" },
  { id: "I3", group: "I", home: "France",   away: "Iraq" },
  { id: "I4", group: "I", home: "Senegal",  away: "Norway" },
  { id: "I5", group: "I", home: "France",   away: "Norway" },
  { id: "I6", group: "I", home: "Senegal",  away: "Iraq" },

  { id: "J1", group: "J", home: "Argentina", away: "Algeria" },
  { id: "J2", group: "J", home: "Austria",   away: "Jordan" },
  { id: "J3", group: "J", home: "Argentina", away: "Austria" },
  { id: "J4", group: "J", home: "Algeria",   away: "Jordan" },
  { id: "J5", group: "J", home: "Argentina", away: "Jordan" },
  { id: "J6", group: "J", home: "Algeria",   away: "Austria" },

  { id: "K1", group: "K", home: "Portugal",   away: "Congo DR" },
  { id: "K2", group: "K", home: "Uzbekistan", away: "Colombia" },
  { id: "K3", group: "K", home: "Portugal",   away: "Uzbekistan" },
  { id: "K4", group: "K", home: "Congo DR",   away: "Colombia" },
  { id: "K5", group: "K", home: "Portugal",   away: "Colombia" },
  { id: "K6", group: "K", home: "Congo DR",   away: "Uzbekistan" },

  { id: "L1", group: "L", home: "England",  away: "Croatia" },
  { id: "L2", group: "L", home: "Ghana",    away: "Panama" },
  { id: "L3", group: "L", home: "England",  away: "Ghana" },
  { id: "L4", group: "L", home: "Croatia",  away: "Panama" },
  { id: "L5", group: "L", home: "England",  away: "Panama" },
  { id: "L6", group: "L", home: "Croatia",  away: "Ghana" },
];

// ── Clinch logic (mirrors App.jsx computeClinch) ───────────────────────────

function computeClinches(actualMatches) {
  const result = []; // [{ group_id, team, position }]
  const TOTAL_GAMES = 3;

  for (const [grp, teams] of Object.entries(GROUPS)) {
    const matches = GROUP_MATCHES.filter(m => m.group === grp);
    const stats = {};
    teams.forEach(t => { stats[t] = { pts: 0, played: 0 }; });

    for (const m of matches) {
      const r = actualMatches[m.id];
      if (!r || r.home_score == null) continue;
      const hs = +r.home_score, as = +r.away_score;
      stats[m.home].played++;
      stats[m.away].played++;
      if (hs > as)      { stats[m.home].pts += 3; }
      else if (as > hs) { stats[m.away].pts += 3; }
      else              { stats[m.home].pts++; stats[m.away].pts++; }
    }

    function h2hWon(t, rival) {
      const m = matches.find(x =>
        (x.home === t && x.away === rival) || (x.home === rival && x.away === t)
      );
      if (!m) return false;
      const r = actualMatches[m.id];
      if (!r || r.home_score == null) return false;
      const hs = +r.home_score, as = +r.away_score;
      return m.home === t ? hs > as : as > hs;
    }

    for (const t of teams) {
      const myPts    = stats[t].pts;
      const myMaxPts = myPts + 3 * (TOTAL_GAMES - stats[t].played);
      const rivals   = teams.filter(r => r !== t);
      const canExceed = rivals.filter(r => stats[r].pts + 3 * (TOTAL_GAMES - stats[r].played) > myPts);
      const canTie    = rivals.filter(r => stats[r].pts + 3 * (TOTAL_GAMES - stats[r].played) === myPts);
      const teamDone  = stats[t].played === TOTAL_GAMES;

      const clinch1 = canExceed.length === 0 &&
        (canTie.length === 0 || (teamDone && canTie.every(r => h2hWon(t, r))));

      const canCatch = rivals.filter(r => stats[r].pts + 3 * (TOTAL_GAMES - stats[r].played) >= myPts);
      const firstStillPossible = rivals.every(r => myMaxPts >= stats[r].pts);
      const clinch2 = !clinch1 && canCatch.length <= 1 && !firstStillPossible;

      if (clinch1) result.push({ group_id: grp, team: t, position: 1 });
      else if (clinch2) result.push({ group_id: grp, team: t, position: 2 });
    }
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────────────────

const { data: matchRows, error: matchErr } = await supabase
  .from("actual_results")
  .select("match_id, home_score, away_score");

if (matchErr) { console.error("fetch error:", matchErr); process.exit(1); }

const actualMatches = {};
for (const r of matchRows || []) actualMatches[r.match_id] = r;

const detected = computeClinches(actualMatches);

if (detected.length === 0) {
  console.log("No clinches detected.");
  process.exit(0);
}

// Load already-stored events so we only insert new ones
const { data: existing } = await supabase
  .from("clinch_events")
  .select("group_id, team, position");

const alreadyStored = new Set(
  (existing || []).map(e => `${e.group_id}|${e.team}|${e.position}`)
);

const newEvents = detected.filter(
  e => !alreadyStored.has(`${e.group_id}|${e.team}|${e.position}`)
);

if (newEvents.length === 0) {
  console.log("All clinches already recorded:", detected.map(e => `${e.team} (${e.position === 1 ? "1st" : "2nd"}, Grp ${e.group_id})`).join(", "));
  process.exit(0);
}

const { error: insertErr } = await supabase
  .from("clinch_events")
  .insert(newEvents);

if (insertErr) { console.error("insert error:", insertErr); process.exit(1); }

console.log("New clinches recorded:");
for (const e of newEvents) {
  console.log(`  Group ${e.group_id}: ${e.team} clinched ${e.position === 1 ? "1st" : "2nd"} place`);
}
