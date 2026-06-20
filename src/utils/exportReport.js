// xlsx is loaded lazily (only when an export is triggered) to keep initial bundle small
const getXLSX = () => import("xlsx").then(m => m);
import { GROUPS, GROUP_MATCHES, KO_ROUNDS, FINAL_RANKS, PLAYERS } from "../constants";
import { supabase } from "../supabase";
import { scoreMatch, scoreGroupTopThree, scoreKOQualifiers, scoreSFRanking } from "../utils";

function matchSortKey(m) {
  const [mo, d, yr] = m.date.split("/");
  const [h, min] = m.time.split(":");
  return new Date(`20${yr}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}T${h.padStart(2,"0")}:${min}:00`).getTime();
}
const MATCHES_BY_TIME = [...GROUP_MATCHES].sort((a, b) => matchSortKey(a) - matchSortKey(b));

// ── Data fetching ──────────────────────────────────────────────────────────

export async function fetchPlayerPreds(playerName) {
  const [pm, pg, pk, pkm] = await Promise.all([
    supabase.from("match_predictions").select("*").eq("player_name", playerName),
    supabase.from("group_ranking_predictions").select("*").eq("player_name", playerName),
    supabase.from("knockout_predictions").select("*").eq("player_name", playerName),
    supabase.from("ko_match_predictions").select("*").eq("player_name", playerName),
  ]);
  return buildPredsObject(playerName, pm.data || [], pg.data || [], pk.data || [], pkm.data || []);
}

export async function fetchAllPlayerPreds() {
  const [pm, pg, pk, pkm, fx] = await Promise.all([
    supabase.from("match_predictions").select("*"),
    supabase.from("group_ranking_predictions").select("*"),
    supabase.from("knockout_predictions").select("*"),
    supabase.from("ko_match_predictions").select("*"),
    supabase.from("ko_fixtures").select("*"),
  ]);
  const fixtures = {};
  (fx.data || []).forEach(r => {
    if (!fixtures[r.round]) fixtures[r.round] = [];
    fixtures[r.round][r.game_index] = { home: r.home_team, away: r.away_team };
  });
  return {
    byPlayer: Object.fromEntries(
      PLAYERS.map(name => [
        name,
        buildPredsObject(
          name,
          (pm.data || []).filter(r => r.player_name === name),
          (pg.data || []).filter(r => r.player_name === name),
          (pk.data || []).filter(r => r.player_name === name),
          (pkm.data || []).filter(r => r.player_name === name),
        ),
      ])
    ),
    fixtures,
  };
}

function buildPredsObject(name, pmRows, pgRows, pkRows, pkmRows) {
  const matches = {};
  pmRows.forEach(r => (matches[r.match_id] = r));

  const groupTopThree = {};
  pgRows.forEach(r => {
    if (Array.isArray(r.ranking))
      groupTopThree[r.group_id] = {
        first:  r.ranking[0] || "",
        second: r.ranking[1] || "",
        third:  r.ranking[2] || "",
      };
  });

  const kp = {};
  pkRows.forEach(r => (kp[r.round] = r.teams || []));

  const koMatches = {};
  pkmRows.forEach(r => {
    if (!koMatches[r.round]) koMatches[r.round] = [];
    koMatches[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score };
  });

  return {
    name, matches, groupTopThree,
    r32:    kp["R32"]    || [],
    r16:    kp["R16"]    || [],
    qf:     kp["QF"]     || [],
    sfRank: kp["SF_RANK"] || [],
    koMatches,
  };
}

// ── Sheet builder ──────────────────────────────────────────────────────────

function buildPlayerSheet(XLSX, preds, fixtures = {}, restrictToStartedRounds = false) {
  const rows = [];

  // ── Group match predictions ──
  rows.push([`WC 2026 Predictions — ${preds.name}`]);
  rows.push([]);
  rows.push(["GROUP STAGE — MATCH SCORE PREDICTIONS"]);
  rows.push(["Group", "Match", "Date", "Home Team", "Pred Home", "Pred Away", "Away Team"]);

  MATCHES_BY_TIME.forEach(m => {
    const p = preds.matches[m.id] || {};
    const hs = p.home_score;
    const as = p.away_score;
    const isDefault = +hs === 10 && +as === 10;
    rows.push([
      `Group ${m.group}`,
      m.id,
      `${m.date} ${m.time}`,
      m.home,
      isDefault || hs == null ? "" : hs,
      isDefault || as == null ? "" : as,
      m.away,
    ]);
  });

  // ── Group rankings ──
  rows.push([]);
  rows.push(["GROUP STAGE — RANKING PREDICTIONS (1st / 2nd / 3rd)"]);
  rows.push(["Group", "1st Place", "2nd Place", "3rd Place"]);
  Object.keys(GROUPS).forEach(grp => {
    const g = preds.groupTopThree[grp] || {};
    rows.push([`Group ${grp}`, g.first || "", g.second || "", g.third || ""]);
  });

  // ── Qualifier picks ──
  rows.push([]);
  rows.push(["QUALIFIER PICKS"]);

  const qualRows = [
    { label: "Round of 32 — 32 teams (10 pts each)", teams: preds.r32,    perRow: 8 },
    { label: "Round of 16 — 16 teams (15 pts each)", teams: preds.r16,    perRow: 8 },
    { label: "Quarter-Finals — 8 teams (20 pts each)", teams: preds.qf,   perRow: 8 },
  ];
  qualRows.forEach(({ label, teams, perRow }) => {
    rows.push([label]);
    const filled = (teams || []).filter(Boolean);
    for (let i = 0; i < filled.length; i += perRow) {
      rows.push(filled.slice(i, i + perRow));
    }
    if (!filled.length) rows.push(["(not filled)"]);
    rows.push([]);
  });

  // Final standings
  rows.push(["Final Standings — Semi-Finals (25 pts per team + 5 pts correct rank)"]);
  rows.push(FINAL_RANKS);
  rows.push((preds.sfRank || []).map(t => t || ""));
  rows.push([]);

  // ── KO match score predictions ──
  // Admin export: only show rounds that have started (no peeking at future picks)
  // Player export: always show all their own picks
  const startedRounds = restrictToStartedRounds
    ? KO_ROUNDS.filter(r => r.firstKickoff && new Date() >= new Date(r.firstKickoff))
    : KO_ROUNDS;
  const hasKO = startedRounds.some(r => (preds.koMatches[r.id] || []).some(Boolean));
  if (startedRounds.length > 0) {
    rows.push(["KNOCKOUT ROUND — MATCH SCORE PREDICTIONS"]);
    if (!hasKO) {
      rows.push(["(no KO score predictions entered yet for started rounds)"]);
    } else {
      rows.push(["Round", "Match #", "Home Team", "Pred Home", "Pred Away", "Away Team"]);
      startedRounds.forEach(r => {
        const rFixtures = fixtures[r.id] || [];
        const rPreds    = preds.koMatches[r.id] || [];
        rFixtures.forEach((fix, i) => {
          if (!fix?.home) return;
          const p  = rPreds[i] || {};
          const hs = p.home_score;
          const as = p.away_score;
          rows.push([
            r.label,
            i + 1,
            fix.home,
            hs != null ? hs : "",
            as != null ? as : "",
            fix.away,
          ]);
        });
      });
    }
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

// ── Public export functions ────────────────────────────────────────────────

/** Download a single player's picks as an Excel file */
export async function exportMyPicks(playerName) {
  const XLSX = await getXLSX();
  const preds = await fetchPlayerPreds(playerName);
  const fx    = await supabase.from("ko_fixtures").select("*");
  const fixtures = {};
  (fx.data || []).forEach(r => {
    if (!fixtures[r.round]) fixtures[r.round] = [];
    fixtures[r.round][r.game_index] = { home: r.home_team, away: r.away_team };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildPlayerSheet(XLSX, preds, fixtures, false), "My Picks");
  XLSX.writeFile(wb, `WC2026_Picks_${playerName}.xlsx`);
}

/** All players: one sheet comparing all players side by side */
export async function exportComparison() {
  const XLSX = await getXLSX();
  const [{ byPlayer, fixtures }, ra, rg, rk, rs] = await Promise.all([
    fetchAllPlayerPreds(),
    supabase.from("actual_results").select("*"),
    supabase.from("actual_group_rankings").select("*"),
    supabase.from("actual_knockout").select("*"),
    supabase.from("ko_actual_scores").select("*"),
  ]);

  // Build actuals lookup
  const actualMatches = {};
  (ra.data || []).forEach(r => (actualMatches[r.match_id] = r));
  const actualGroups = {};
  (rg.data || []).forEach(r => {
    if (Array.isArray(r.ranking))
      actualGroups[r.group_id] = { first: r.ranking[0] || "", second: r.ranking[1] || "", third: r.ranking[2] || "" };
  });
  const actualKO = {};
  (rk.data || []).forEach(r => (actualKO[r.round] = r.teams || []));
  const actualKOScores = {};
  (rs.data || []).forEach(r => {
    if (!actualKOScores[r.round]) actualKOScores[r.round] = [];
    actualKOScores[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score };
  });

  const startedRounds = KO_ROUNDS.filter(r => r.firstKickoff && new Date() >= new Date(r.firstKickoff));

  // Pre-compute running totals per player (for summary row)
  const totals = Object.fromEntries(PLAYERS.map(n => [n, 0]));

  // Helper: interleave [Pred, Score] columns for each player
  const playerHeaders = PLAYERS.flatMap(name => [name, "Pts"]);

  const rows = [];

  // ── TOTALS summary (filled in at the end, placeholder for now) ──
  const totalsRowIdx = 1; // row index 1 (after title row)
  rows.push(["WC 2026 — ALL PLAYERS COMPARISON"]);
  rows.push(["TOTAL SCORE", "", "", "", "", "", ...PLAYERS.flatMap(name => [name, ""])]);  // placeholder

  // ── Group match scores ──
  rows.push([]);
  rows.push(["GROUP STAGE — MATCH SCORE PREDICTIONS"]);
  rows.push(["Group", "Match", "Date & Time", "Home", "Away", "Actual", ...playerHeaders]);
  MATCHES_BY_TIME.forEach(m => {
    const act = actualMatches[m.id];
    const actualScore = act?.home_score != null ? `${act.home_score}-${act.away_score}` : "";
    rows.push([
      `Group ${m.group}`, m.id, `${m.date} ${m.time}`, m.home, m.away, actualScore,
      ...PLAYERS.flatMap(name => {
        const p = byPlayer[name].matches[m.id] || {};
        const hs = p.home_score, as = p.away_score;
        const pred = (hs == null || (+hs === 10 && +as === 10)) ? "" : `${hs}-${as}`;
        const pts = act ? scoreMatch(p, act).total : "";
        if (typeof pts === "number") totals[name] += pts;
        return [pred, pts === 0 ? "" : pts];
      }),
    ]);
  });

  // ── Group rankings ──
  rows.push([]);
  rows.push(["GROUP STAGE — TOP 3 RANKINGS"]);
  rows.push(["Group", "Position", "Actual", ...playerHeaders]);
  Object.keys(GROUPS).forEach(grp => {
    ["1st", "2nd", "3rd"].forEach((pos, i) => {
      const key = ["first", "second", "third"][i];
      const actGrp = actualGroups[grp];
      rows.push([
        `Group ${grp}`, pos, actGrp?.[key] || "",
        ...PLAYERS.flatMap(name => {
          const pred = byPlayer[name].groupTopThree[grp]?.[key] || "";
          // Score the whole group top-3 on the last rank row, show on 3rd row
          if (i < 2) return [pred, ""];
          const pts = actGrp ? scoreGroupTopThree(byPlayer[name].groupTopThree[grp], actGrp) : "";
          if (typeof pts === "number") totals[name] += pts;
          return [pred, pts === 0 ? "" : pts];
        }),
      ]);
    });
  });

  // ── KO qualifiers ──
  rows.push([]);
  rows.push(["KNOCKOUT QUALIFIER PICKS"]);
  [
    { label: "Round of 32 (32 teams)", key: "r32", round: "R32", pts: 10 },
    { label: "Round of 16 (16 teams)", key: "r16", round: "R16", pts: 15 },
    { label: "Quarter-Finals (8 teams)", key: "qf",  round: "QF",  pts: 20 },
  ].forEach(({ label, key, round, pts: ptsPer }) => {
    const actualTeams = [...(actualKO[round] || [])].filter(Boolean).sort();
    rows.push([label, "Actual", ...playerHeaders]);
    const maxLen = Math.max(actualTeams.length, ...PLAYERS.map(n => (byPlayer[n][key] || []).filter(Boolean).length));
    const playerSorted = Object.fromEntries(PLAYERS.map(n => [n, (byPlayer[n][key] || []).filter(Boolean).sort()]));
    // Score row at the end of each section
    const sectionPts = Object.fromEntries(PLAYERS.map(n => [n, scoreKOQualifiers(byPlayer[n][key], actualKO[round], ptsPer)]));
    PLAYERS.forEach(name => { totals[name] += sectionPts[name] || 0; });
    for (let i = 0; i < maxLen; i++) {
      const isLast = i === maxLen - 1;
      rows.push([
        `#${i + 1}`, actualTeams[i] || "",
        ...PLAYERS.flatMap(name => [
          playerSorted[name][i] || "",
          isLast ? (sectionPts[name] || "") : "",
        ]),
      ]);
    }
    rows.push([]);
  });

  // Final standings
  rows.push(["FINAL STANDINGS (1st–4th)"]);
  rows.push(["Position", "Actual", ...playerHeaders]);
  FINAL_RANKS.forEach((pos, i) => {
    const isLast = i === FINAL_RANKS.length - 1;
    const sfPts = isLast
      ? Object.fromEntries(PLAYERS.map(n => [n, scoreSFRanking(byPlayer[n].sfRank, actualKO["SF_RANK"])]))
      : null;
    if (sfPts) PLAYERS.forEach(name => { totals[name] += sfPts[name] || 0; });
    rows.push([
      pos, actualKO["SF_RANK"]?.[i] || "",
      ...PLAYERS.flatMap(name => [
        (byPlayer[name].sfRank || [])[i] || "",
        sfPts ? (sfPts[name] || "") : "",
      ]),
    ]);
  });

  // ── KO match scores (started rounds only) ──
  if (startedRounds.length > 0) {
    rows.push([]);
    rows.push(["KNOCKOUT MATCH SCORE PREDICTIONS (started rounds)"]);
    rows.push(["Round", "Match", "Home", "Away", "Actual", ...playerHeaders]);
    startedRounds.forEach(r => {
      (fixtures[r.id] || []).forEach((fix, i) => {
        if (!fix?.home) return;
        const act = (actualKOScores[r.id] || [])[i];
        const actualScore = act?.home_score != null ? `${act.home_score}-${act.away_score}` : "";
        rows.push([
          r.label, i + 1, fix.home, fix.away, actualScore,
          ...PLAYERS.flatMap(name => {
            const p = (byPlayer[name].koMatches[r.id] || [])[i] || {};
            const pred = p.home_score != null ? `${p.home_score}-${p.away_score}` : "";
            const pts = act ? scoreMatch(p, act).total : "";
            if (typeof pts === "number") totals[name] += pts;
            return [pred, pts === 0 ? "" : pts];
          }),
        ]);
      });
    });
  }

  // Fill in totals summary row
  rows[totalsRowIdx] = [
    "TOTAL SCORE", "", "", "", "", "",
    ...PLAYERS.flatMap(name => [name, totals[name]]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "All Picks Comparison");
  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `WC2026_Comparison_${date}.xlsx`);
}

/** Admin: download one sheet per player */
export async function exportAllPicks() {
  const XLSX = await getXLSX();
  const { byPlayer, fixtures } = await fetchAllPlayerPreds();
  const wb = XLSX.utils.book_new();

  PLAYERS.forEach(name => {
    const ws = buildPlayerSheet(XLSX, byPlayer[name], fixtures, false);
    const sheetName = name.substring(0, 31).replace(/[:\\/?*[\]]/g, "_");
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `WC2026_AllPicks_${date}.xlsx`);
}
