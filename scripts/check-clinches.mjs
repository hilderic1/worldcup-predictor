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

// ── Exact standings when all games are played ─────────────────────────────
// Tiebreaker order (per FIFA, simplified — no fair play or lots):
//   pts → H2H pts → H2H GD → H2H GF → overall GD → overall GF → null (unresolvable)
// Returns { first, second, third } where a value is null when a tie can't be broken.
function computeGroupStandings(teams, matches, actualMatches) {
  const stats = {};
  const h2h = {}; // h2h[a][b] = { gf, ga } for team a in the match against b
  teams.forEach(t => {
    stats[t] = { pts: 0, gf: 0, ga: 0 };
    h2h[t] = {};
    teams.forEach(u => { if (u !== t) h2h[t][u] = { gf: 0, ga: 0 }; });
  });
  for (const m of matches) {
    const r = actualMatches[m.id];
    if (!r || r.home_score == null) continue;
    const hs = +r.home_score, as = +r.away_score;
    stats[m.home].gf += hs; stats[m.home].ga += as;
    stats[m.away].gf += as; stats[m.away].ga += hs;
    h2h[m.home][m.away].gf += hs; h2h[m.home][m.away].ga += as;
    h2h[m.away][m.home].gf += as; h2h[m.away][m.home].ga += hs;
    if (hs > as)      { stats[m.home].pts += 3; }
    else if (as > hs) { stats[m.away].pts += 3; }
    else              { stats[m.home].pts++; stats[m.away].pts++; }
  }

  // Pairwise comparison (works correctly for 2-team ties;
  // for 3-way ties on pts the H2H sub-table is too complex so we fall back to overall stats).
  function cmp(a, b) {
    if (stats[b].pts !== stats[a].pts) return stats[b].pts - stats[a].pts;
    const ha = h2h[a][b], hb = h2h[b][a];
    const h2hPtsA = ha.gf > ha.ga ? 3 : ha.gf === ha.ga ? 1 : 0;
    const h2hPtsB = hb.gf > hb.ga ? 3 : hb.gf === hb.ga ? 1 : 0;
    if (h2hPtsB !== h2hPtsA) return h2hPtsB - h2hPtsA;
    const h2hGdB = hb.gf - hb.ga, h2hGdA = ha.gf - ha.ga;
    if (h2hGdB !== h2hGdA) return h2hGdB - h2hGdA;
    if (hb.gf !== ha.gf) return hb.gf - ha.gf;
    const gdB = stats[b].gf - stats[b].ga, gdA = stats[a].gf - stats[a].ga;
    if (gdB !== gdA) return gdB - gdA;
    if (stats[b].gf !== stats[a].gf) return stats[b].gf - stats[a].gf;
    return 0; // unresolvable without fair play / lots
  }

  const sorted = [...teams].sort(cmp);

  // If two adjacent teams are still equal, the position between them is unresolvable
  const tied = (i) => cmp(sorted[i], sorted[i + 1]) === 0;
  return {
    first:  tied(0)              ? null : sorted[0],
    second: tied(0) || tied(1)   ? null : sorted[1],
    third:  tied(1) || tied(2)   ? null : sorted[2],
  };
}

// ── Clinch logic (mirrors App.jsx computeClinch) ───────────────────────────

function computeClinches(actualMatches) {
  const result = []; // [{ group_id, team, position }]
  const TOTAL_GAMES = 3;

  for (const [grp, teams] of Object.entries(GROUPS)) {
    const matches = GROUP_MATCHES.filter(m => m.group === grp);

    // When all games are played we know the exact final standings
    const allPlayed = matches.every(m => {
      const r = actualMatches[m.id];
      return r && r.home_score != null;
    });
    if (allPlayed) {
      const { first, second, third } = computeGroupStandings(teams, matches, actualMatches);
      if (first)  result.push({ group_id: grp, team: first,  position: 1 });
      if (second) result.push({ group_id: grp, team: second, position: 2 });
      if (third)  result.push({ group_id: grp, team: third,  position: 3 });
      if (!first || !second || !third)
        console.log(`Group ${grp}: tie unresolvable without fair play data — partial standings saved.`);
      continue;
    }

    // Early clinch detection for in-progress groups
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

      const clinch1 = canExceed.length === 0 &&
        (canTie.length === 0 || canTie.every(r => h2hWon(t, r)));

      const canCatch = rivals.filter(r => stats[r].pts + 3 * (TOTAL_GAMES - stats[r].played) >= myPts);
      const firstStillPossible = rivals.every(r => myMaxPts >= stats[r].pts);
      const clinch2 = !clinch1 && canCatch.length <= 1 && !firstStillPossible;

      // Clinch 3rd: at most 2 rivals can still mathematically finish above this team
      const canBeat = rivals.filter(r => {
        const rMax = stats[r].pts + 3 * (TOTAL_GAMES - stats[r].played);
        return rMax > myPts || (rMax === myPts && !h2hWon(t, r));
      });
      const clinch3 = !clinch1 && !clinch2 && canBeat.length <= 2;

      if (clinch1)      result.push({ group_id: grp, team: t, position: 1 });
      else if (clinch2) result.push({ group_id: grp, team: t, position: 2 });
      else if (clinch3) result.push({ group_id: grp, team: t, position: 3 });
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

// ── Always propagate ALL clinches to actual tables ────────────────────────
// (newEvents only gates the clinch_events feed insert, not the data sync)

// ── Update actual_group_rankings ───────────────────────────────────────────
const { data: rankingRows } = await supabase.from("actual_group_rankings").select("*");
const rankings = {};
(rankingRows || []).forEach(r => {
  if (Array.isArray(r.ranking))
    rankings[r.group_id] = { first: r.ranking[0] || "", second: r.ranking[1] || "", third: r.ranking[2] || "" };
});

const rankingUpdates = [];
for (const e of detected) {
  const cur = rankings[e.group_id] || { first: "", second: "", third: "" };
  const key  = e.position === 1 ? "first" : e.position === 2 ? "second" : "third";
  if (cur[key] !== e.team) {
    cur[key] = e.team;
    rankings[e.group_id] = cur;
    rankingUpdates.push({
      group_id: e.group_id,
      ranking: [cur.first, cur.second, cur.third],
    });
  }
}

if (rankingUpdates.length) {
  const { error: rErr } = await supabase
    .from("actual_group_rankings")
    .upsert(rankingUpdates, { onConflict: "group_id" });
  if (rErr) { console.error("ranking update error:", rErr); process.exit(1); }
  else console.log("Group rankings updated:", rankingUpdates.map(r => `Group ${r.group_id}`).join(", "));
}

// ── Update actual_knockout R32 bracket ────────────────────────────────────
const R32_MATCHES = [
  { match: "M73", home: { type: "R", grp: "A" }, away: { type: "R", grp: "B" } },
  { match: "M74", home: { type: "W", grp: "E" }, away: { type: "3", col: 3  } },
  { match: "M75", home: { type: "W", grp: "F" }, away: { type: "R", grp: "C" } },
  { match: "M76", home: { type: "W", grp: "C" }, away: { type: "R", grp: "F" } },
  { match: "M77", home: { type: "W", grp: "I" }, away: { type: "3", col: 5  } },
  { match: "M78", home: { type: "R", grp: "E" }, away: { type: "R", grp: "I" } },
  { match: "M79", home: { type: "W", grp: "A" }, away: { type: "3", col: 0  } },
  { match: "M80", home: { type: "W", grp: "L" }, away: { type: "3", col: 7  } },
  { match: "M81", home: { type: "W", grp: "D" }, away: { type: "3", col: 2  } },
  { match: "M82", home: { type: "W", grp: "G" }, away: { type: "3", col: 4  } },
  { match: "M83", home: { type: "R", grp: "K" }, away: { type: "R", grp: "L" } },
  { match: "M84", home: { type: "W", grp: "H" }, away: { type: "R", grp: "J" } },
  { match: "M85", home: { type: "W", grp: "B" }, away: { type: "3", col: 1  } },
  { match: "M86", home: { type: "W", grp: "J" }, away: { type: "R", grp: "H" } },
  { match: "M87", home: { type: "W", grp: "K" }, away: { type: "3", col: 6  } },
  { match: "M88", home: { type: "R", grp: "D" }, away: { type: "R", grp: "G" } },
];

const { data: koRow } = await supabase
  .from("actual_knockout")
  .select("teams")
  .eq("round", "R32")
  .single();

const r32Teams = (koRow?.teams || Array(32).fill("")).slice();

for (const e of detected) {
  const r32Type = e.position === 1 ? "W" : "R";
  R32_MATCHES.forEach((m, i) => {
    [{ slot: m.home, idx: i * 2 }, { slot: m.away, idx: i * 2 + 1 }].forEach(({ slot, idx }) => {
      if (slot.grp === e.group_id && slot.type === r32Type && !r32Teams[idx])
        r32Teams[idx] = e.team;
    });
  });
}

const { error: koErr } = await supabase
  .from("actual_knockout")
  .upsert([{ round: "R32", teams: r32Teams }], { onConflict: "round" });
if (koErr) { console.error("R32 update error:", koErr); process.exit(1); }

// ── Update ko_fixtures for R32 ─────────────────────────────────────────────
// Resolve the bracket using all currently known group rankings
const { data: allRankingRows } = await supabase.from("actual_group_rankings").select("*");
const allRankings = {};
(allRankingRows || []).forEach(r => {
  if (Array.isArray(r.ranking))
    allRankings[r.group_id] = { W: r.ranking[0] || "", R: r.ranking[1] || "" };
});

function resolveSlot(slot) {
  if (slot.type === "W" || slot.type === "R") return allRankings[slot.grp]?.[slot.type] || "";
  return ""; // 3rd-place slots need full group completion — skip
}

const fixtureRows = [];
R32_MATCHES.forEach((m, i) => {
  const home = resolveSlot(m.home);
  const away = resolveSlot(m.away);
  if (home || away) {
    fixtureRows.push({ round: "R32", game_index: i, home_team: home, away_team: away });
  }
});

if (fixtureRows.length) {
  const { error: fixErr } = await supabase
    .from("ko_fixtures")
    .upsert(fixtureRows, { onConflict: "round,game_index" });
  if (fixErr) { console.error("ko_fixtures update error:", fixErr); process.exit(1); }
  else console.log(`R32 fixtures updated (${fixtureRows.length} matches).`);
}

// ── Insert only truly new clinch_events ───────────────────────────────────
if (newEvents.length === 0) {
  console.log("No new clinch events to record (data sync complete).");
  process.exit(0);
}

const { error: insertErr } = await supabase.from("clinch_events").insert(newEvents);
if (insertErr) { console.error("clinch_events insert error:", insertErr); process.exit(1); }

console.log("New clinch events recorded:");
for (const e of newEvents) {
  const posLabel = e.position === 1 ? "1st" : e.position === 2 ? "2nd" : "3rd";
  console.log(`  Group ${e.group_id}: ${e.team} clinched ${posLabel} place`);
}
