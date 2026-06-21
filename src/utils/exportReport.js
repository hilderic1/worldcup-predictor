// xlsx is loaded lazily (only when an export is triggered) to keep initial bundle small
const getXLSX  = () => import("xlsx").then(m => m);
const getExcel = () => import("exceljs").then(m => m.default ?? m);
import { GROUPS, GROUP_MATCHES, KO_ROUNDS, FINAL_RANKS, PLAYERS, PLAYER_COLORS } from "../constants";
import { supabase } from "../supabase";
import { scoreMatch, scoreGroupTopThree, scoreKOQualifiers, scoreSFRanking, currentOpenRound } from "../utils";

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

/** All players: one sheet comparing all players side by side (styled via ExcelJS) */
export async function exportComparison(viewerName = null) {
  const ExcelJS = await getExcel();
  const [{ byPlayer, fixtures }, ra, rg, rk, rs] = await Promise.all([
    fetchAllPlayerPreds(),
    supabase.from("actual_results").select("*"),
    supabase.from("actual_group_rankings").select("*"),
    supabase.from("actual_knockout").select("*"),
    supabase.from("ko_actual_scores").select("*"),
  ]);

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

  // Picks for a KO round are visible to all once a later round is open.
  // Until then only the viewer's own picks are shown; others' cells are left blank.
  const _roundOrder = ["GROUP", "R32", "R16", "QF", "SF", "FINAL", "CLOSED"];
  const _openRound  = currentOpenRound();
  function roundVisibleToAll(roundId) {
    return _roundOrder.indexOf(_openRound) > _roundOrder.indexOf(roundId);
  }
  function canViewPlayer(name, roundId) {
    return !viewerName || name === viewerName || roundVisibleToAll(roundId);
  }

  // ── ExcelJS helpers ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "WC2026 Predictor";
  const ws = wb.addWorksheet("All Picks Comparison", { views: [{ state: "frozen", ySplit: 3 }] });

  // Fixed columns: Group/Match/Date/Home/Away/Actual (6), then 2 per player
  const FIXED = 6;
  const totalCols = FIXED + PLAYERS.length * 2;

  // Column widths
  ws.getColumn(1).width = 9;   // group
  ws.getColumn(2).width = 7;   // match id
  ws.getColumn(3).width = 14;  // date+time
  ws.getColumn(4).width = 18;  // home
  ws.getColumn(5).width = 18;  // away
  ws.getColumn(6).width = 9;   // actual
  PLAYERS.forEach((_, pi) => {
    ws.getColumn(FIXED + 1 + pi * 2).width = 12; // pred
    ws.getColumn(FIXED + 2 + pi * 2).width = 5;  // pts
  });

  // hex "#rrggbb" → "FFrrggbb" ARGB
  const argb = hex => "FF" + hex.replace("#", "");

  // Palette
  const C = {
    darkBg:    "FF0A1628",
    midBg:     "FF0E1E38",
    lightBg:   "FF1A2A48",
    gold:      "FFF0C030",
    actualBg:  "FF1C3050",
    altRow:    "FF0D1B30",
    white:     "FFFFFFFF",
    muted:     "FF8899AA",
    ptsCol:    "FF0B1525",
    sectionBg: "FF162240",
    totBg:     "FF0A1628",
  };

  // Border presets
  const playerLeftBorder  = { left:  { style: "medium", color: { argb: C.gold } } };
  const playerRightBorder = { right: { style: "medium", color: { argb: C.gold } } };
  const thinGray = { style: "thin", color: { argb: "FF1E3050" } };

  function styleCell(cell, opts = {}) {
    const { bg, fg = C.white, bold = false, italic = false, size = 10,
            hAlign = "left", vAlign = "middle", wrapText = false,
            borderLeft = false, borderRight = false, borderTop = false, borderBottom = false } = opts;
    if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.font = { bold, italic, size, color: { argb: fg }, name: "Calibri" };
    cell.alignment = { horizontal: hAlign, vertical: vAlign, wrapText };
    const b = {};
    if (borderLeft)   b.left   = typeof borderLeft   === "object" ? borderLeft   : { style: "thin", color: { argb: C.gold } };
    if (borderRight)  b.right  = typeof borderRight  === "object" ? borderRight  : { style: "thin", color: { argb: C.gold } };
    if (borderTop)    b.top    = typeof borderTop    === "object" ? borderTop    : thinGray;
    if (borderBottom) b.bottom = typeof borderBottom === "object" ? borderBottom : thinGray;
    if (Object.keys(b).length) cell.border = b;
  }

  // Style all cells in a row range
  function styleRow(row, colStart, colEnd, opts) {
    for (let c = colStart; c <= colEnd; c++) styleCell(row.getCell(c), opts);
  }

  // Apply player column borders for every data row
  function applyPlayerBorders(row, isFirstDataRow = false) {
    PLAYERS.forEach((_, pi) => {
      const predCol = FIXED + 1 + pi * 2;
      const ptsCol  = FIXED + 2 + pi * 2;
      const predCell = row.getCell(predCol);
      const ptsCell  = row.getCell(ptsCol);
      const top = isFirstDataRow ? { style: "medium", color: { argb: C.gold } } : thinGray;
      predCell.border = { ...predCell.border, left: { style: "medium", color: { argb: C.gold } }, top };
      ptsCell.border  = { ...ptsCell.border,  right: { style: "medium", color: { argb: C.gold } }, top };
    });
  }

  // Draw a medium white bottom border across all cells of the last-added row
  // (used to separate groups in the Top-3 section)
  function addGroupSeparator() {
    const row = ws.getRow(rowNum);
    const sep = { style: "medium", color: { argb: "FF2A4070" } };
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.border = { ...cell.border, bottom: sep };
    }
  }

  function applyPlayerBottomBorders(row) {
    PLAYERS.forEach((_, pi) => {
      const predCell = row.getCell(FIXED + 1 + pi * 2);
      const ptsCell  = row.getCell(FIXED + 2 + pi * 2);
      const bottom = { style: "medium", color: { argb: C.gold } };
      predCell.border = { ...predCell.border, left:  { style: "medium", color: { argb: C.gold } }, bottom };
      ptsCell.border  = { ...ptsCell.border,  right: { style: "medium", color: { argb: C.gold } }, bottom };
    });
  }

  let rowNum = 0;

  // ── Title row ──────────────────────────────────────────────────────────────
  rowNum++;
  const titleRow = ws.getRow(rowNum);
  titleRow.height = 22;
  titleRow.getCell(1).value = "⚽  WC 2026 — All Players Picks & Scores";
  styleRow(titleRow, 1, totalCols, { bg: C.darkBg, fg: C.gold, bold: true, size: 13, hAlign: "center" });
  ws.mergeCells(rowNum, 1, rowNum, totalCols);

  // ── Total score row ────────────────────────────────────────────────────────
  rowNum++;
  const totalsRow = ws.getRow(rowNum);
  totalsRow.height = 18;
  const totals = Object.fromEntries(PLAYERS.map(n => [n, 0]));
  const totalsRowRef = rowNum; // fill values at end

  // ── Column header row ──────────────────────────────────────────────────────
  rowNum++;
  const hdrRow = ws.getRow(rowNum);
  hdrRow.height = 28;
  ["Group/Round", "ID", "Date & Time", "Home", "Away", "Actual"].forEach((h, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = h;
    styleCell(cell, { bg: C.midBg, fg: C.muted, bold: true, size: 9, hAlign: "center", vAlign: "middle" });
  });
  PLAYERS.forEach((name, pi) => {
    const color = argb(PLAYER_COLORS[name] || "#8899AA");
    const predCell = hdrRow.getCell(FIXED + 1 + pi * 2);
    const ptsCell  = hdrRow.getCell(FIXED + 2 + pi * 2);
    predCell.value = name;
    ptsCell.value  = "Pts";
    styleCell(predCell, { bg: color, fg: C.darkBg, bold: true, size: 10, hAlign: "center", vAlign: "middle",
      borderLeft: { style: "medium", color: { argb: C.gold } } });
    styleCell(ptsCell,  { bg: color, fg: C.darkBg, bold: true, size: 9,  hAlign: "center", vAlign: "middle",
      borderRight: { style: "medium", color: { argb: C.gold } } });
  });

  // ── Helper: add a section title row ───────────────────────────────────────
  function addSection(title) {
    rowNum++;
    const r = ws.getRow(rowNum);
    r.height = 16;
    r.getCell(1).value = title;
    styleRow(r, 1, totalCols, { bg: C.sectionBg, fg: C.gold, bold: true, size: 10 });
    ws.mergeCells(rowNum, 1, rowNum, totalCols);
    return r;
  }

  // ── Helper: add a sub-header row (for KO qualifier sections) ──────────────
  function addSubHeader(labels) {
    rowNum++;
    const r = ws.getRow(rowNum);
    r.height = 14;
    labels.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v;
      styleCell(cell, { bg: C.lightBg, fg: C.muted, bold: true, size: 9, hAlign: "center" });
    });
    PLAYERS.forEach((name, pi) => {
      const color = argb(PLAYER_COLORS[name] || "#8899AA");
      const predCell = r.getCell(FIXED + 1 + pi * 2);
      const ptsCell  = r.getCell(FIXED + 2 + pi * 2);
      predCell.value = name;
      ptsCell.value  = "Pts";
      styleCell(predCell, { bg: color, fg: C.darkBg, bold: true, size: 9, hAlign: "center",
        borderLeft: { style: "medium", color: { argb: C.gold } } });
      styleCell(ptsCell,  { bg: color, fg: C.darkBg, bold: true, size: 9, hAlign: "center",
        borderRight: { style: "medium", color: { argb: C.gold } } });
    });
    return r;
  }

  // ── Helper: add a data row ─────────────────────────────────────────────────
  let dataRowCount = 0;
  function addDataRow(fixedValues, playerFn, isLast = false) {
    rowNum++;
    dataRowCount++;
    const r = ws.getRow(rowNum);
    r.height = 14;
    const even = dataRowCount % 2 === 0;
    const baseBg = even ? C.altRow : C.midBg;

    fixedValues.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v;
      const isActual = i === 5;
      styleCell(cell, {
        bg: isActual ? C.actualBg : baseBg,
        fg: isActual ? C.gold : C.white,
        bold: isActual,
        size: 10,
        hAlign: i >= 3 ? "left" : "center",
        borderBottom: thinGray, borderTop: thinGray,
      });
    });

    PLAYERS.forEach((name, pi) => {
      const { pred, pts } = playerFn(name);
      const predCell = r.getCell(FIXED + 1 + pi * 2);
      const ptsCell  = r.getCell(FIXED + 2 + pi * 2);
      predCell.value = pred || "";
      ptsCell.value  = typeof pts === "number" && pts > 0 ? pts : "";
      const left  = { style: "medium", color: { argb: C.gold } };
      const right = { style: "medium", color: { argb: C.gold } };
      const bottom = isLast ? { style: "medium", color: { argb: C.gold } } : thinGray;
      styleCell(predCell, { bg: baseBg, fg: C.white, size: 10, hAlign: "center",
        borderLeft: left, borderBottom: bottom, borderTop: thinGray });
      styleCell(ptsCell,  { bg: C.ptsCol, fg: typeof pts === "number" && pts > 0 ? C.gold : C.muted,
        bold: typeof pts === "number" && pts > 0, size: 10, hAlign: "center",
        borderRight: right, borderBottom: bottom, borderTop: thinGray });
    });

    if (isLast) dataRowCount = 0; // reset alternation between sections
    return r;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP STAGE — MATCH SCORES
  // ══════════════════════════════════════════════════════════════════════════
  addSection("GROUP STAGE — MATCH SCORE PREDICTIONS");
  addSubHeader(["Group", "Match", "Date & Time", "Home", "Away", "Actual"]);

  const matchRows = MATCHES_BY_TIME;
  matchRows.forEach((m, idx) => {
    const act = actualMatches[m.id];
    const actualScore = act?.home_score != null ? `${act.home_score}-${act.away_score}` : "";
    addDataRow(
      [`Grp ${m.group}`, m.id, `${m.date} ${m.time}`, m.home, m.away, actualScore],
      name => {
        const p = byPlayer[name].matches[m.id] || {};
        const hs = p.home_score, as = p.away_score;
        const pred = (hs == null || (+hs === 10 && +as === 10)) ? "" : `${hs}-${as}`;
        const pts = act ? scoreMatch(p, act).total : null;
        if (typeof pts === "number") totals[name] += pts;
        return { pred, pts };
      },
      idx === matchRows.length - 1,
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP STAGE — TOP 3 RANKINGS
  // ══════════════════════════════════════════════════════════════════════════
  addSection("GROUP STAGE — TOP 3 RANKINGS");
  addSubHeader(["Group", "Position", "Actual", "", "", ""]);

  const groupKeys = Object.keys(GROUPS);
  // Score each position independently: 5 pts if team appears anywhere in top-3,
  // +5 bonus if predicted in the exact correct position.
  function scorePosition(predTeam, key, actual) {
    if (!predTeam || !actual) return null;
    const inTop3 = [actual.first, actual.second, actual.third].includes(predTeam);
    if (!inTop3) return null;
    return actual[key] === predTeam ? 10 : 5;
  }

  groupKeys.forEach((grp, gi) => {
    const isLastGroup = gi === groupKeys.length - 1;
    ["1st", "2nd", "3rd"].forEach((pos, ri) => {
      const key = ["first", "second", "third"][ri];
      const actGrp = actualGroups[grp];
      const isLastRow = isLastGroup && ri === 2;
      addDataRow(
        [`Group ${grp}`, pos, actGrp?.[key] || "", "", "", ""],
        name => {
          const pred = byPlayer[name].groupTopThree[grp]?.[key] || "";
          const pts = scorePosition(pred, key, actGrp);
          if (typeof pts === "number") totals[name] += pts;
          return { pred, pts };
        },
        isLastRow,
      );
      // Draw a separator line after each group's 3rd row (except the last group)
      if (ri === 2 && !isLastGroup) addGroupSeparator();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // KO QUALIFIER PICKS
  // ══════════════════════════════════════════════════════════════════════════
  addSection("KNOCKOUT QUALIFIER PICKS");

  [
    { label: "Round of 32 — 32 teams (10 pts each)", key: "r32", round: "R32", ptsPer: 10 },
    { label: "Round of 16 — 16 teams (15 pts each)", key: "r16", round: "R16", ptsPer: 15 },
    { label: "Quarter-Finals — 8 teams (20 pts each)", key: "qf", round: "QF", ptsPer: 20 },
  ].forEach(({ label, key, round, ptsPer }) => {
    addSubHeader([label, "Actual", "", "", "", ""]);
    const actualSet    = new Set((actualKO[round] || []).filter(Boolean));
    const actualTeams  = [...actualSet].sort();
    const playerSorted = Object.fromEntries(PLAYERS.map(n => [n, (byPlayer[n][key] || []).filter(Boolean).sort()]));
    const maxLen = Math.max(actualTeams.length, ...PLAYERS.map(n => playerSorted[n].length), 1);

    for (let i = 0; i < maxLen; i++) {
      addDataRow(
        [`#${i + 1}`, actualTeams[i] || "", "", "", "", ""],
        name => {
          if (!canViewPlayer(name, round)) return { pred: "🔒", pts: null };
          const team = playerSorted[name][i] || "";
          const pts = team && actualSet.size > 0 && actualSet.has(team) ? ptsPer : null;
          if (typeof pts === "number") totals[name] += pts;
          return { pred: team, pts };
        },
        i === maxLen - 1,
      );
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL STANDINGS
  // ══════════════════════════════════════════════════════════════════════════
  addSection("FINAL STANDINGS — Semi-Finals (25 pts per team + 5 pts correct rank)");
  addSubHeader(["Position", "Actual", "", "", "", ""]);

  FINAL_RANKS.forEach((pos, i) => {
    const isLast = i === FINAL_RANKS.length - 1;
    const sfPts = isLast
      ? Object.fromEntries(PLAYERS.map(n => [n, canViewPlayer(n, "SF") ? scoreSFRanking(byPlayer[n].sfRank, actualKO["SF_RANK"]) : 0]))
      : null;
    if (sfPts) PLAYERS.forEach(name => { totals[name] += sfPts[name] || 0; });
    addDataRow(
      [pos, actualKO["SF_RANK"]?.[i] || "", "", "", "", ""],
      name => {
        if (!canViewPlayer(name, "SF")) return { pred: "🔒", pts: null };
        return {
          pred: (byPlayer[name].sfRank || [])[i] || "",
          pts: sfPts ? sfPts[name] : null,
        };
      },
      isLast,
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // KO MATCH SCORES (started rounds)
  // ══════════════════════════════════════════════════════════════════════════
  if (startedRounds.length > 0) {
    addSection("KNOCKOUT MATCH SCORE PREDICTIONS");
    addSubHeader(["Round", "Match #", "Home", "Away", "Actual", ""]);

    const koDataRows = [];
    startedRounds.forEach(r => {
      (fixtures[r.id] || []).forEach((fix, i) => {
        if (fix?.home) koDataRows.push({ r, fix, i });
      });
    });
    koDataRows.forEach(({ r, fix, i }, idx) => {
      const act = (actualKOScores[r.id] || [])[i];
      const actualScore = act?.home_score != null ? `${act.home_score}-${act.away_score}` : "";
      addDataRow(
        [r.label, i + 1, fix.home, fix.away, actualScore, ""],
        name => {
          if (!canViewPlayer(name, r.id)) return { pred: "🔒", pts: null };
          const p = (byPlayer[name].koMatches[r.id] || [])[i] || {};
          const pred = p.home_score != null ? `${p.home_score}-${p.away_score}` : "";
          const pts = act ? scoreMatch(p, act).total : null;
          if (typeof pts === "number") totals[name] += pts;
          return { pred, pts };
        },
        idx === koDataRows.length - 1,
      );
    });
  }

  // ── Fill totals row ────────────────────────────────────────────────────────
  const tr = ws.getRow(totalsRowRef);
  tr.height = 20;
  tr.getCell(1).value = "TOTAL SCORE";
  styleCell(tr.getCell(1), { bg: C.totBg, fg: C.gold, bold: true, size: 11 });
  for (let c = 2; c <= FIXED; c++)
    styleCell(tr.getCell(c), { bg: C.totBg });

  PLAYERS.forEach((name, pi) => {
    const color = argb(PLAYER_COLORS[name] || "#8899AA");
    const predCell = tr.getCell(FIXED + 1 + pi * 2);
    const ptsCell  = tr.getCell(FIXED + 2 + pi * 2);
    predCell.value = name;
    ptsCell.value  = totals[name];
    styleCell(predCell, { bg: color, fg: C.darkBg, bold: true, size: 11, hAlign: "center",
      borderLeft: { style: "medium", color: { argb: C.gold } } });
    styleCell(ptsCell,  { bg: color, fg: C.darkBg, bold: true, size: 13, hAlign: "center",
      borderRight: { style: "medium", color: { argb: C.gold } } });
  });

  // ── Write file ─────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WC2026_Comparison_${new Date().toISOString().split("T")[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
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
