import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase";
import { GLOBAL_DEADLINE, KO_ROUNDS, GROUPS, GROUP_MATCHES, R32_MATCHES, f } from "../constants";
import { isPast, currentOpenRound } from "../utils";
import FIFA_TABLE from "../data/fifaTable";
import { FIFA_RANKINGS, OPTA_WIN_PCT } from "../data/teamStrengths";

const SCORE_CATEGORIES = [
  { key: "matchPts",   label: "Group Scores",       icon: "⚽", desc: "Match result + accuracy + exact" },
  { key: "koMatchPts", label: "KO Scores",           icon: "🥊", desc: "Knockout match predictions" },
  { key: "groupPts",   label: "Group Rankings",      icon: "📊", desc: "1st, 2nd & 3rd per group" },
  { key: "r32Pts",     label: "Round of 32",         icon: "32", desc: "10 pts per correct qualifier" },
  { key: "r16Pts",     label: "Round of 16",         icon: "16", desc: "15 pts per correct qualifier" },
  { key: "qfPts",      label: "Quarter-Finals",      icon: "🏅", desc: "20 pts per correct qualifier" },
  { key: "sfPts",      label: "Semi-Finals / Final", icon: "🏆", desc: "25 pts per team + 5 pts correct rank" },
];

function ordinal(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

// ── Group standings helpers ────────────────────────────────────────────────

function isFilled(pred) {
  if (!pred || pred.home_score == null || pred.away_score == null) return false;
  if (+pred.home_score === 10 && +pred.away_score === 10) return false; // sentinel
  return true;
}

/** Build basic W/D/L/GF/GA/GD/Pts stats for all teams in a group */
function buildStats(teams, matches, preds) {
  const s = {};
  teams.forEach(t => {
    s[t] = { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });
  matches.forEach(m => {
    const p = preds[m.id];
    if (!isFilled(p)) return;
    const hs = +p.home_score, as = +p.away_score;
    if (!s[m.home] || !s[m.away]) return;
    s[m.home].played++; s[m.away].played++;
    s[m.home].gf += hs; s[m.home].ga += as;
    s[m.away].gf += as; s[m.away].ga += hs;
    s[m.home].gd = s[m.home].gf - s[m.home].ga;
    s[m.away].gd = s[m.away].gf - s[m.away].ga;
    if (hs > as) { s[m.home].won++; s[m.home].points += 3; s[m.away].lost++; }
    else if (hs < as) { s[m.away].won++; s[m.away].points += 3; s[m.home].lost++; }
    else { s[m.home].drawn++; s[m.home].points++; s[m.away].drawn++; s[m.away].points++; }
  });
  return Object.values(s);
}

/** Head-to-head stats for a subset of teams (only matches between those teams) */
function calcH2H(teamNames, matches, preds) {
  const h = {};
  teamNames.forEach(t => { h[t] = { points: 0, gd: 0, gf: 0 }; });
  const set = new Set(teamNames);
  matches.forEach(m => {
    if (!set.has(m.home) || !set.has(m.away)) return;
    const p = preds[m.id];
    if (!isFilled(p)) return;
    const hs = +p.home_score, as = +p.away_score;
    h[m.home].gf += hs; h[m.home].gd += hs - as;
    h[m.away].gf += as; h[m.away].gd += as - hs;
    if (hs > as) h[m.home].points += 3;
    else if (hs < as) h[m.away].points += 3;
    else { h[m.home].points++; h[m.away].points++; }
  });
  return h;
}

/**
 * Sort a group of teams that are already tied on points.
 * FIFA tiebreaker order:
 *   H2H pts → H2H GD → H2H GF → overall GD → overall GF → colour tie
 * Returns { sorted, tiedTeams: Set<string> }
 */
// FIFA tiebreaker: lower rank number = stronger team (rank 1 beats rank 50)
function fifaRank(team) { return FIFA_RANKINGS[team] ?? 999; }

function sortTiedGroup(group, matches, preds) {
  if (group.length === 1) return { sorted: group, tiedTeams: new Set() };
  const h = calcH2H(group.map(t => t.team), matches, preds);

  const sorted = [...group].sort((a, b) => {
    const ah = h[a.team], bh = h[b.team];
    if (bh.points !== ah.points) return bh.points - ah.points; // H2H pts
    if (bh.gd     !== ah.gd)     return bh.gd     - ah.gd;     // H2H GD
    if (bh.gf     !== ah.gf)     return bh.gf     - ah.gf;     // H2H GF
    if (b.gd      !== a.gd)      return b.gd      - a.gd;      // overall GD
    if (b.gf      !== a.gf)      return b.gf      - a.gf;      // overall GF
    const ra = fifaRank(a.team), rb = fifaRank(b.team);
    if (ra !== rb)               return ra - rb;                // FIFA ranking
    return 0; // true colour tie — fair play cards required
  });

  // Only mark as tied if ALL criteria including FIFA ranking are equal
  const tiedTeams = new Set();
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const ah = h[a.team], bh = h[b.team];
    if (bh.points === ah.points && bh.gd === ah.gd && bh.gf === ah.gf &&
        b.gd === a.gd && b.gf === a.gf && fifaRank(a.team) === fifaRank(b.team)) {
      tiedTeams.add(a.team);
      tiedTeams.add(b.team);
    }
  }
  return { sorted, tiedTeams };
}

/** Full sort with tiebreakers; returns { sorted, tiedTeams: Set<string> } */
function sortStandings(stats, matches, preds) {
  const allTied = new Set();
  const byPoints = [...stats].sort((a, b) => b.points - a.points);
  const result = [];
  let i = 0;
  while (i < byPoints.length) {
    let j = i + 1;
    while (j < byPoints.length && byPoints[j].points === byPoints[i].points) j++;
    if (j > i + 1) {
      const { sorted, tiedTeams } = sortTiedGroup(byPoints.slice(i, j), matches, preds);
      result.push(...sorted);
      tiedTeams.forEach(t => allTied.add(t));
    } else {
      result.push(byPoints[i]);
    }
    i = j;
  }
  return { sorted: result, tiedTeams: allTied };
}

// ── R32 bracket helpers ────────────────────────────────────────────────────

// The 8 R32 matches that host a 3rd-place team, indexed by column position (0-7)
// [matchNum, groupWinner, "vs 3rd of …"]
const R32_3RD_SLOTS = [
  { match: "M79", winner: "A", constraint: "C/E/F/H/I" },
  { match: "M85", winner: "B", constraint: "E/F/G/I/J" },
  { match: "M81", winner: "D", constraint: "B/E/F/I/J" },
  { match: "M74", winner: "E", constraint: "A/B/C/D/F" },
  { match: "M82", winner: "G", constraint: "A/E/H/I/J" },
  { match: "M77", winner: "I", constraint: "C/D/F/G/H" },
  { match: "M87", winner: "K", constraint: "D/E/I/J/L" },
  { match: "M80", winner: "L", constraint: "E/H/I/J/K" },
];

/**
 * Build the R32 bracket from group standings and a user-confirmed set of
 * 8 qualifying group letters (selectedThirds).
 */
function buildR32Bracket(groupStandings, selectedThirds) {
  // Extract 1st / 2nd / 3rd per group
  const pos = {};
  Object.entries(groupStandings).forEach(([grp, { sorted }]) => {
    pos[grp] = {
      W: sorted[0]?.team || "?",
      R: sorted[1]?.team || "?",
    };
  });

  // 3rd-place team lookup from user selection
  const thirdByGrp = {};
  Object.entries(groupStandings).forEach(([grp, { sorted }]) => {
    if (selectedThirds.has(grp) && sorted[2]) thirdByGrp[grp] = sorted[2].team;
  });

  // FIFA table lookup
  const qualGrps  = [...selectedThirds].sort().join("");
  const colAssign = FIFA_TABLE[qualGrps] || null;

  function resolveTeam(slot) {
    if (slot.type === "W") return { team: pos[slot.grp]?.W || "?", label: `1${slot.grp}` };
    if (slot.type === "R") return { team: pos[slot.grp]?.R || "?", label: `2${slot.grp}` };
    if (slot.type === "3") {
      if (!colAssign) return { team: "?", label: "3rd ?" };
      const srcGrp = colAssign[slot.col];
      const team   = thirdByGrp[srcGrp] || "?";
      return { team, label: `3${srcGrp}` };
    }
    return { team: "?", label: "?" };
  }

  return R32_MATCHES.map(m => {
    const home = resolveTeam(m.home);
    const away = resolveTeam(m.away);
    return { match: m.match, home, away, homeType: m.home.type, awayType: m.away.type };
  });
}


// ── Full bracket simulation ────────────────────────────────────────────────

/**
 * Given the 16 R32 matches (from buildR32Bracket) and a strength source,
 * simulate every round through the Final and 3rd-place match.
 *
 * source: 'opta' | 'fifa'
 * Returns: { r16Matches, r16Winners, qfMatches, qfWinners,
 *             sfMatches, sfWinners, sfLosers,
 *             finalMatch, thirdMatch, ranking:[1st,2nd,3rd,4th] }
 */
function simulateFullBracket(r32Matches, source, strengths) {
  const fifaRanks = strengths?.fifa || FIFA_RANKINGS;
  const optaPcts  = strengths?.opta || OPTA_WIN_PCT;

  function stronger(a, b) {
    if (!a || a === "?") return b || "";
    if (!b || b === "?") return a || "";
    if (source === "fifa") {
      return (fifaRanks[a] ?? 999) <= (fifaRanks[b] ?? 999) ? a : b;
    }
    return (optaPcts[a] ?? 0) >= (optaPcts[b] ?? 0) ? a : b;
  }

  // R32 → 16 winners
  const r32Winners = r32Matches.map(m => stronger(m.home.team, m.away.team));

  // R16 — consecutive pairs from R32 bracket (M73-88 pairs: 0-1, 2-3, …)
  const r16Matches = [];
  const r16Winners = [];
  for (let i = 0; i < 16; i += 2) {
    const h = r32Winners[i], a = r32Winners[i + 1];
    r16Matches.push({ home: h, away: a });
    r16Winners.push(stronger(h, a));
  }

  // QF — consecutive pairs from R16
  const qfMatches = [];
  const qfWinners = [];
  for (let i = 0; i < 8; i += 2) {
    const h = r16Winners[i], a = r16Winners[i + 1];
    qfMatches.push({ home: h, away: a });
    qfWinners.push(stronger(h, a));
  }

  // SF — consecutive pairs from QF
  const sfMatches = [
    { home: qfWinners[0], away: qfWinners[1] },
    { home: qfWinners[2], away: qfWinners[3] },
  ];
  const sfWinners = sfMatches.map(m => stronger(m.home, m.away));
  const sfLosers  = sfMatches.map((m, i) => sfWinners[i] === m.home ? m.away : m.home);

  // Final & 3rd place
  const finalMatch      = { home: sfWinners[0],  away: sfWinners[1]  };
  const thirdPlaceMatch = { home: sfLosers[0],   away: sfLosers[1]   };
  const champion  = stronger(sfWinners[0], sfWinners[1]);
  const runnerUp  = champion === sfWinners[0] ? sfWinners[1] : sfWinners[0];
  const third     = stronger(sfLosers[0],  sfLosers[1]);
  const fourth    = third === sfLosers[0]  ? sfLosers[1]  : sfLosers[0];

  return {
    r32Winners,                        // 16 teams advancing to R16
    r16Matches, r16Winners,            // r16Winners = 8 teams advancing to QF
    qfMatches,  qfWinners,             // qfWinners  = 4 teams advancing to SF
    sfMatches,  sfWinners, sfLosers,
    finalMatch, thirdPlaceMatch,
    ranking: [champion, runnerUp, third, fourth],
  };
}

// ── Component ──────────────────────────────────────────────────────────────

// Parse a GROUP_MATCHES date "M/D/YY" + time "HH:MM" to a UTC ms timestamp
function matchKickoffMs(m) {
  const [mo, dy] = m.date.split("/");
  const [hh, mm] = m.time.split(":");
  return new Date(`2026-${mo.padStart(2,"0")}-${dy.padStart(2,"0")}T${hh.padStart(2,"0")}:${mm}:00Z`).getTime();
}

// All group matches sorted chronologically (computed once)
const SORTED_GROUP_MATCHES = [...GROUP_MATCHES].sort((a, b) => matchKickoffMs(a) - matchKickoffMs(b));

export default function Dashboard({ player, lastLogin, leaderboard, leaderboardLoading, onNavigate, messages, onMarkRead, teamStrengths, actualMatches = {} }) {
  const openRound  = currentOpenRound();
  const globalLocked = isPast(GLOBAL_DEADLINE);

  const myEntry    = leaderboard.find(e => e.name === player?.name);
  const myRank     = myEntry ? leaderboard.indexOf(myEntry) + 1 : null;
  const totalPlayers = leaderboard.length;

  const nextDeadline = !globalLocked
    ? { label: "Global deadline — all qualifying picks lock", date: "10 Jun 2026 23:59 (Portugal)" }
    : KO_ROUNDS.find(r => !isPast(r.deadline))
      ? { label: `${KO_ROUNDS.find(r => !isPast(r.deadline)).label} deadline`,
          date: KO_ROUNDS.find(r => !isPast(r.deadline)).deadline }
      : null;

  const unread = (messages || []).filter(m => !m.read);

  // ── Group standings state ──
  const [matchPreds,     setMatchPreds]     = useState({});
  const [groupStandings, setGroupStandings] = useState({});
  const [statsLoading,   setStatsLoading]   = useState(false);

  // Load this player's match predictions
  useEffect(() => {
    if (!player?.name) return;
    setStatsLoading(true);
    supabase
      .from("match_predictions")
      .select("match_id, home_score, away_score")
      .eq("player_name", player.name)
      .then(({ data }) => {
        const mp = {};
        (data || []).forEach(r => { mp[r.match_id] = r; });
        setMatchPreds(mp);
        setStatsLoading(false);
      });
  }, [player?.name]);

  // Recompute standings whenever predictions change
  useEffect(() => {
    const standings = {};
    Object.entries(GROUPS).forEach(([grp, teams]) => {
      const grpMatches = GROUP_MATCHES.filter(m => m.group === grp);
      const stats = buildStats(teams, grpMatches, matchPreds);
      standings[grp] = sortStandings(stats, grpMatches, matchPreds);
    });
    setGroupStandings(standings);
  }, [matchPreds]);

  const anyTies = Object.values(groupStandings).some(g => g?.tiedTeams?.size > 0);

  // 3rd-place ranking and user selection for R32
  const [rankedThirds, setRankedThirds] = useState([]);   // all 12, sorted
  const [selectedThirds, setSelectedThirds] = useState(new Set()); // 8 group letters

  useEffect(() => {
    if (Object.keys(groupStandings).length < 12) return;
    const thirds = Object.entries(groupStandings).map(([grp, { sorted }]) => {
      const t = sorted[2];
      return t ? { team: t.team, grp, points: t.points, gd: t.gd, gf: t.gf } : null;
    }).filter(Boolean);
    thirds.sort((a, b) =>
      b.points !== a.points ? b.points - a.points :
      b.gd     !== a.gd     ? b.gd     - a.gd     :
      b.gf     !== a.gf     ? b.gf     - a.gf     :
      fifaRank(a.team) - fifaRank(b.team) // FIFA ranking tiebreaker
    );
    setRankedThirds(thirds);
    // Auto-select top 8; user can adjust any tied border teams
    setSelectedThirds(new Set(thirds.slice(0, 8).map(t => t.grp)));
  }, [groupStandings]);

  // R32 bracket (derived from selected thirds)
  const [r32Matches, setR32Matches] = useState([]);
  useEffect(() => {
    if (selectedThirds.size === 8 && Object.keys(groupStandings).length === 12) {
      setR32Matches(buildR32Bracket(groupStandings, selectedThirds));
    }
  }, [groupStandings, selectedThirds]);

  // Bracket simulation source + derived result
  const [simSource,     setSimSource]     = useState("opta"); // 'opta' | 'fifa'
  const [applyingPicks, setApplyingPicks] = useState(false);
  const [picksApplied,  setPicksApplied]  = useState(false);

  const r32Ready = r32Matches.length === 16 &&
    r32Matches.every(m => m.home.team && m.home.team !== "?" &&
                          m.away.team && m.away.team !== "?");

  const simResult = useMemo(() => {
    if (!r32Ready) return null;
    return simulateFullBracket(r32Matches, simSource, teamStrengths);
  }, [r32Matches, r32Ready, simSource, teamStrengths]);

  async function applySimToPicks() {
    if (!simResult || !player?.name) return;
    setApplyingPicks(true);
    setPicksApplied(false);
    try {
      const r32Teams = r32Matches.flatMap(m => [m.home.team, m.away.team]).filter(t => t && t !== "?");
      const rows = [
        { player_name: player.name, round: "R32",     teams: r32Teams },              // 32 group-stage qualifiers
        { player_name: player.name, round: "R16",     teams: simResult.r32Winners },  // 16 R32 winners → advance to R16
        { player_name: player.name, round: "QF",      teams: simResult.r16Winners },  // 8 R16 winners → advance to QF
        { player_name: player.name, round: "SF_RANK", teams: simResult.ranking },     // 4 semi-finalists ranked
      ];
      await supabase.from("knockout_predictions").upsert(rows, { onConflict: "player_name,round" });
      setPicksApplied(true);
      setTimeout(() => setPicksApplied(false), 4000);
    } finally {
      setApplyingPicks(false);
    }
  }

  // Clinch events
  const [clinchEvents, setClinchEvents] = useState([]);
  useEffect(() => {
    supabase
      .from("clinch_events")
      .select("group_id, team, position, detected_at")
      .order("detected_at", { ascending: false })
      .then(({ data }) => setClinchEvents(data || []));
  }, []);

  // Which results tile is open: null | 'results' | 'standings'
  const [resultsTile, setResultsTile] = useState(null);
  function toggleResultsTile(key) { setResultsTile(prev => prev === key ? null : key); }

  // Actual group standings derived from admin-entered results
  const actualStandings = useMemo(() => {
    const standings = {};
    Object.entries(GROUPS).forEach(([grp, teams]) => {
      const grpMatches = GROUP_MATCHES.filter(m => m.group === grp);
      const stats = buildStats(teams, grpMatches, actualMatches);
      standings[grp] = sortStandings(stats, grpMatches, actualMatches);
    });
    return standings;
  }, [actualMatches]);

  // Which simulation tile is open: null | 'groups' | 'r32' | 'bracket'
  const [simTile, setSimTile] = useState(null);
  function toggleTile(key) { setSimTile(prev => prev === key ? null : key); }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Admin messages */}
      {unread.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {unread.map(m => (
            <div key={m.id} className="notice amber"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div><strong>📬 Message from Admin:</strong> {m.body}</div>
              <button style={{ flexShrink: 0, fontSize: 11, padding: "2px 10px", cursor: "pointer" }}
                onClick={() => onMarkRead(m.id)}>Dismiss</button>
            </div>
          ))}
        </div>
      )}

      {/* Clinch feed */}
      {clinchEvents.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-label">🏅 Clinched Qualifications</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {clinchEvents.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: e.position === 1 ? "#f0c030" : "var(--text-main)" }}>
                  {e.position === 1 ? "🥇" : "🥈"} {e.team}
                </span>
                <span style={{ color: "var(--text-dark)" }}>
                  clinched {e.position === 1 ? "1st" : "2nd"} in Group {e.group_id}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-dark)" }}>
                  {new Date(e.detected_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-left">
          <div className="dashboard-greeting">Welcome back,</div>
          <div className="dashboard-player-name">{player?.name}</div>
          {lastLogin && (
            <div style={{ fontSize: 11, color: "var(--text-dark)", marginTop: 4 }}>
              Last login:{" "}
              {new Date(lastLogin).toLocaleString("en-GB", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
          )}
          {openRound === "GROUP" && !globalLocked && (
            <div className="dashboard-status open">🟢 Group stage — predictions open</div>
          )}
          {openRound !== "GROUP" && openRound !== "CLOSED" && (
            <div className="dashboard-status amber">
              ⚽ {KO_ROUNDS.find(r => r.id === openRound)?.label} scores open
            </div>
          )}
          {openRound === "CLOSED" && (
            <div className="dashboard-status closed">🏁 Tournament complete</div>
          )}
        </div>
        <div className="dashboard-rank-card">
          {leaderboardLoading ? (
            <div className="spinner" style={{ minHeight: "auto", padding: "20px 0" }}>Loading…</div>
          ) : myRank ? (
            <>
              <div className="dashboard-rank-pos">{ordinal(myRank)}</div>
              <div className="dashboard-rank-label">of {totalPlayers} players</div>
              <div className="dashboard-total-pts">{myEntry?.total ?? 0}</div>
              <div className="dashboard-pts-label">points</div>
            </>
          ) : (
            <div className="dashboard-rank-label" style={{ padding: "20px 0" }}>No data yet</div>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <div className="section-title">📊 Score Breakdown</div>
      </div>
      {leaderboardLoading ? (
        <div className="spinner">Calculating scores…</div>
      ) : myEntry ? (
        <div className="dashboard-score-grid">
          {SCORE_CATEGORIES.map(cat => (
            <div key={cat.key} className="dashboard-score-card">
              <div className="dashboard-score-icon">{cat.icon}</div>
              <div className="dashboard-score-pts">{myEntry[cat.key] ?? 0}</div>
              <div className="dashboard-score-cat">{cat.label}</div>
              <div className="dashboard-score-desc">{cat.desc}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="notice info">No score data yet — make your picks to get started!</div>
      )}

      {/* Quick Actions */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <div className="section-title">🚀 Quick Actions</div>
      </div>
      <div className="dashboard-actions">
        <button className="dashboard-action-card" onClick={() => onNavigate("picks")}>
          <div className="dashboard-action-icon">⚽</div>
          <div className="dashboard-action-label">My Picks</div>
          <div className="dashboard-action-desc">Enter or update your predictions</div>
        </button>
        <button className="dashboard-action-card" onClick={() => onNavigate("leaderboard")}>
          <div className="dashboard-action-icon">🏆</div>
          <div className="dashboard-action-label">Leaderboard</div>
          <div className="dashboard-action-desc">See how everyone is doing</div>
        </button>
        <button className="dashboard-action-card" onClick={() => onNavigate("profile")}>
          <div className="dashboard-action-icon">👤</div>
          <div className="dashboard-action-label">Profile</div>
          <div className="dashboard-action-desc">Your account settings</div>
        </button>
      </div>

      {/* Results */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <div className="section-title">📋 Results</div>
      </div>
      <div className="dashboard-actions">

        {/* ── Match Results tile ── */}
        <button
          className={`dashboard-action-card ${resultsTile === "results" ? "active" : ""}`}
          onClick={() => toggleResultsTile("results")}
          style={resultsTile === "results" ? { borderColor: "#4caf80", background: "rgba(76,175,128,0.07)" } : {}}
        >
          <div className="dashboard-action-icon">⚽</div>
          <div className="dashboard-action-label">Match Results</div>
          <div className="dashboard-action-desc">All group games in order of play</div>
          <div style={{ fontSize: 10, color: "#4caf80", marginTop: 6 }}>
            {resultsTile === "results" ? "▲ collapse" : "▼ expand"}
          </div>
        </button>

        {/* ── Actual Standings tile ── */}
        <button
          className={`dashboard-action-card ${resultsTile === "standings" ? "active" : ""}`}
          onClick={() => toggleResultsTile("standings")}
          style={resultsTile === "standings" ? { borderColor: "#4caf80", background: "rgba(76,175,128,0.07)" } : {}}
        >
          <div className="dashboard-action-icon">📊</div>
          <div className="dashboard-action-label">Actual Standings</div>
          <div className="dashboard-action-desc">Group standings from actual results</div>
          <div style={{ fontSize: 10, color: "#4caf80", marginTop: 6 }}>
            {resultsTile === "standings" ? "▲ collapse" : "▼ expand"}
          </div>
        </button>

      </div>

      {/* ── Match Results panel ── */}
      {resultsTile === "results" && (() => {
        // Group sorted matches by date label
        const byDate = [];
        let curDate = null;
        SORTED_GROUP_MATCHES.forEach(m => {
          const [mo, dy] = m.date.split("/");
          const label = new Date(`2026-${mo.padStart(2,"0")}-${dy.padStart(2,"0")}T12:00:00Z`)
            .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
          if (label !== curDate) {
            byDate.push({ label, matches: [] });
            curDate = label;
          }
          byDate[byDate.length - 1].matches.push(m);
        });
        const played  = Object.keys(actualMatches).length;
        const total   = GROUP_MATCHES.length;
        return (
          <div className="card" style={{ marginTop: 8 }}>
            <div className="card-label">
              Group stage matches in chronological order — {played} of {total} results entered
            </div>
            {byDate.map(({ label, matches }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
                  color: "#4caf80", marginBottom: 6, marginTop: 10,
                }}>
                  {label}
                </div>
                {matches.map(m => {
                  const res     = actualMatches[m.id];
                  const hasResult = res && res.home_score != null && res.away_score != null;
                  return (
                    <div key={m.id} style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr auto 1fr",
                      gap: 4,
                      alignItems: "center",
                      padding: "5px 0",
                      borderBottom: "1px solid #0e1a2e",
                    }}>
                      <span style={{ fontSize: 10, color: "var(--text-dark)", fontWeight: 700 }}>{m.id}</span>
                      <div style={{ textAlign: "right", fontSize: 12, fontWeight: hasResult ? 700 : 400, color: hasResult ? "var(--text-main)" : "var(--text-dark)", whiteSpace: "nowrap" }}>
                        {f(m.home)} {m.home}
                      </div>
                      <div style={{ textAlign: "center", minWidth: 54, fontSize: 13, fontWeight: 700, color: hasResult ? "#f0c030" : "var(--text-dark)", padding: "0 6px" }}>
                        {hasResult ? `${res.home_score} – ${res.away_score}` : "vs"}
                      </div>
                      <div style={{ textAlign: "left", fontSize: 12, fontWeight: hasResult ? 700 : 400, color: hasResult ? "var(--text-main)" : "var(--text-dark)", whiteSpace: "nowrap" }}>
                        {m.away} {f(m.away)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: 11, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ color: "#f0c030" }}>■ Result entered</span>
              <span style={{ color: "var(--text-dark)" }}>■ Upcoming / not yet entered</span>
            </div>
          </div>
        );
      })()}

      {/* ── Actual Standings panel ── */}
      {resultsTile === "standings" && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-label">
            Actual Group Standings — based on results entered by Admin
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
            gap: 14,
            marginTop: 14,
          }}>
            {Object.entries(GROUPS).map(([grp]) => {
              const { sorted = [], tiedTeams = new Set() } = actualStandings[grp] || {};
              const grpMatches = GROUP_MATCHES.filter(m => m.group === grp);
              const played = grpMatches.filter(m => {
                const r = actualMatches[m.id];
                return r && r.home_score != null && r.away_score != null;
              }).length;
              return (
                <div key={grp} style={{ background: "#0a1628", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#4caf80" }}>GROUP {grp}</span>
                    <span style={{ fontSize: 10, color: played === grpMatches.length ? "#4caf80" : "var(--text-dark)", fontWeight: played === grpMatches.length ? 700 : 400 }}>
                      {played}/{grpMatches.length} played
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ color: "var(--text-dark)", borderBottom: "1px solid #1a2a3a" }}>
                        <td style={{ padding: "2px 3px", width: 16 }}>#</td>
                        <td style={{ padding: "2px 3px" }}>Team</td>
                        <td style={{ padding: "2px 3px", textAlign: "center", width: 20 }}>P</td>
                        <td style={{ padding: "2px 3px", textAlign: "center", width: 20 }}>W</td>
                        <td style={{ padding: "2px 3px", textAlign: "center", width: 20 }}>D</td>
                        <td style={{ padding: "2px 3px", textAlign: "center", width: 20 }}>L</td>
                        <td style={{ padding: "2px 3px", textAlign: "center", width: 28 }}>GD</td>
                        <td style={{ padding: "2px 3px", textAlign: "center", width: 28, fontWeight: 700 }}>Pts</td>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((row, idx) => {
                        const isTied    = tiedTeams.has(row.team);
                        const qualifies = idx < 2;
                        const rowColor  = isTied ? "#f0c030" : qualifies ? "#c8d8f0" : "var(--text-dark)";
                        return (
                          <tr key={row.team} style={{ borderBottom: "1px solid #0e1a2e" }}>
                            <td style={{ padding: "3px 3px", color: rowColor, fontWeight: qualifies ? 700 : 400 }}>{idx + 1}</td>
                            <td style={{ padding: "3px 3px", color: rowColor, fontWeight: qualifies ? 700 : 400, whiteSpace: "nowrap" }}>
                              {f(row.team)} {row.team}
                            </td>
                            <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>{row.played}</td>
                            <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>{row.won}</td>
                            <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>{row.drawn}</td>
                            <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>{row.lost}</td>
                            <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>
                              {row.gd > 0 ? "+" : ""}{row.gd}
                            </td>
                            <td style={{ padding: "3px 3px", textAlign: "center", color: rowColor, fontWeight: 700 }}>{row.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 11, flexWrap: "wrap" }}>
            <span style={{ color: "#c8d8f0" }}>■ Advances (top 2)</span>
            <span style={{ color: "#f0c030" }}>■ Colour tie — only fair play (cards) can separate these teams</span>
          </div>
        </div>
      )}

      {/* Simulations */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <div className="section-title">🔬 Simulations</div>
      </div>

      {/* Simulation tile grid */}
      <div className="dashboard-actions">

        {/* ── Group Standings tile ── */}
        <button
          className={`dashboard-action-card ${simTile === "groups" ? "active" : ""}`}
          onClick={() => toggleTile("groups")}
          style={simTile === "groups" ? { borderColor: "#f0c030", background: "rgba(240,192,48,0.07)" } : {}}
        >
          <div className="dashboard-action-icon">📊</div>
          <div className="dashboard-action-label">Group Standings</div>
          <div className="dashboard-action-desc">Standings if your picks were correct</div>
          <div style={{ fontSize: 10, color: "#f0c030", marginTop: 6 }}>
            {simTile === "groups" ? "▲ collapse" : "▼ expand"}
          </div>
        </button>

        {/* ── Round of 32 tile ── */}
        <button
          className={`dashboard-action-card ${simTile === "r32" ? "active" : ""}`}
          onClick={() => toggleTile("r32")}
          style={simTile === "r32" ? { borderColor: "#f0c030", background: "rgba(240,192,48,0.07)" } : {}}
        >
          <div className="dashboard-action-icon">⚔️</div>
          <div className="dashboard-action-label">Round of 32</div>
          <div className="dashboard-action-desc">Simulated R32 bracket</div>
          <div style={{ fontSize: 10, color: "#f0c030", marginTop: 6 }}>
            {simTile === "r32" ? "▲ collapse" : "▼ expand"}
          </div>
        </button>

        {/* ── Full Tournament Bracket tile ── */}
        <button
          className={`dashboard-action-card ${simTile === "bracket" ? "active" : ""}`}
          onClick={() => toggleTile("bracket")}
          style={simTile === "bracket" ? { borderColor: "#f0c030", background: "rgba(240,192,48,0.07)" } : {}}
        >
          <div className="dashboard-action-icon">🏆</div>
          <div className="dashboard-action-label">Full Bracket</div>
          <div className="dashboard-action-desc">Simulate R16 → Final &amp; apply to picks</div>
          <div style={{ fontSize: 10, color: "#f0c030", marginTop: 6 }}>
            {simTile === "bracket" ? "▲ collapse" : "▼ expand"}
          </div>
        </button>

      </div>

      {/* ── Group Standings panel ── */}
      {simTile === "groups" && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-label">
            Predicted Group Standings — how each group would finish if your picks were correct
          </div>
          {statsLoading ? (
            <div className="spinner">Calculating standings…</div>
          ) : (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
                gap: 14,
                marginTop: 14,
              }}>
                {Object.entries(GROUPS).map(([grp]) => {
                  const { sorted = [], tiedTeams = new Set() } = groupStandings[grp] || {};
                  const grpMatches = GROUP_MATCHES.filter(m => m.group === grp);
                  const predicted  = grpMatches.filter(m => isFilled(matchPreds[m.id])).length;
                  const allFilled  = predicted === grpMatches.length;
                  return (
                    <div key={grp} style={{ background: "#0a1628", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#f0c030" }}>GROUP {grp}</span>
                        <span style={{ fontSize: 10, color: allFilled ? "#4caf80" : "var(--text-dark)", fontWeight: allFilled ? 700 : 400 }}>
                          {predicted}/{grpMatches.length} matches
                        </span>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ color: "var(--text-dark)", borderBottom: "1px solid #1a2a3a" }}>
                            <td style={{ padding: "2px 3px", width: 16 }}>#</td>
                            <td style={{ padding: "2px 3px" }}>Team</td>
                            <td style={{ padding: "2px 3px", textAlign: "center", width: 20 }}>P</td>
                            <td style={{ padding: "2px 3px", textAlign: "center", width: 20 }}>W</td>
                            <td style={{ padding: "2px 3px", textAlign: "center", width: 20 }}>D</td>
                            <td style={{ padding: "2px 3px", textAlign: "center", width: 20 }}>L</td>
                            <td style={{ padding: "2px 3px", textAlign: "center", width: 28 }}>GD</td>
                            <td style={{ padding: "2px 3px", textAlign: "center", width: 28, fontWeight: 700 }}>Pts</td>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((row, idx) => {
                            const isTied    = tiedTeams.has(row.team);
                            const qualifies = idx < 2;
                            const rowColor  = isTied ? "#f0c030" : qualifies ? "#c8d8f0" : "var(--text-dark)";
                            return (
                              <tr key={row.team} style={{ borderBottom: "1px solid #0e1a2e" }}>
                                <td style={{ padding: "3px 3px", color: rowColor, fontWeight: qualifies ? 700 : 400 }}>{idx + 1}</td>
                                <td style={{ padding: "3px 3px", color: rowColor, fontWeight: qualifies ? 700 : 400, whiteSpace: "nowrap" }}>
                                  {f(row.team)} {row.team}
                                </td>
                                <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>{row.played}</td>
                                <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>{row.won}</td>
                                <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>{row.drawn}</td>
                                <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>{row.lost}</td>
                                <td style={{ padding: "3px 3px", textAlign: "center", color: "var(--text-dark)" }}>
                                  {row.gd > 0 ? "+" : ""}{row.gd}
                                </td>
                                <td style={{ padding: "3px 3px", textAlign: "center", color: rowColor, fontWeight: 700 }}>{row.points}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 11, flexWrap: "wrap" }}>
                <span style={{ color: "#c8d8f0" }}>■ Advances (top 2)</span>
                <span style={{ color: "#f0c030" }}>■ Colour tie — only fair play (cards) can separate these teams</span>
              </div>
              {anyTies && (
                <div className="notice warn" style={{ marginTop: 8, fontSize: 11 }}>
                  ⚠ Some teams are tied on all available criteria. Actual resolution requires fair play scores and FIFA rankings.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Round of 32 panel ── */}
      {simTile === "r32" && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-label">
            Round of 32 — Simulated bracket based on your predicted group standings
          </div>
          {statsLoading ? (
            <div className="spinner">Calculating bracket…</div>
          ) : rankedThirds.length === 0 ? (
            <div className="notice info">Enter group match predictions to simulate the R32 bracket.</div>
          ) : (
            <>
              {/* ── 3rd-place qualifier selector ── */}
              {(() => {
                // Border = 8th and 9th teams are genuinely tied on ALL criteria incl. FIFA rank
                const t8 = rankedThirds[7], t9 = rankedThirds[8];
                const hasActualTie = t8 && t9 &&
                  t8.points === t9.points && t8.gd === t9.gd && t8.gf === t9.gf &&
                  fifaRank(t8.team) === fifaRank(t9.team);
                const isBorder = t => hasActualTie &&
                  t.points === t8.points && t.gd === t8.gd && t.gf === t8.gf &&
                  fifaRank(t.team) === fifaRank(t8.team);
                const isCertainIn  = t => !isBorder(t) && selectedThirds.has(t.grp);
                const isCertainOut = t => !isBorder(t) && !selectedThirds.has(t.grp);

                function toggleThird(grp) {
                  setSelectedThirds(prev => {
                    const next = new Set(prev);
                    if (next.has(grp)) {
                      if (next.size > 8) next.delete(grp); // only delete if over 8
                      // Never go below 8: if already 8 selected, swap via border logic
                      // (handled below)
                    } else {
                      next.add(grp);
                    }
                    return next;
                  });
                }

                // For border teams: clicking a non-selected border team replaces
                // a selected border team (maintaining exactly 8)
                function clickBorder(grp) {
                  setSelectedThirds(prev => {
                    if (prev.has(grp)) return prev; // can't deselect without a swap
                    // Find a selected border team to swap out
                    const borderSelected = rankedThirds.filter(t => isBorder(t) && prev.has(t.grp));
                    if (borderSelected.length === 0) return prev;
                    const next = new Set(prev);
                    next.delete(borderSelected[borderSelected.length - 1].grp);
                    next.add(grp);
                    return next;
                  });
                }

                return (
                  <div style={{ marginBottom:16, marginTop:8 }}>
                    <div style={{ fontSize:11, color:"var(--text-dark)", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>
                      3rd-place qualifiers — 8 of 12 advance
                    </div>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                      <thead>
                        <tr style={{ color:"var(--text-dark)", borderBottom:"1px solid #1a2a3a" }}>
                          <td style={{padding:"2px 4px",width:20}}>#</td>
                          <td style={{padding:"2px 4px"}}>Team</td>
                          <td style={{padding:"2px 4px",textAlign:"center",width:28}}>Pts</td>
                          <td style={{padding:"2px 4px",textAlign:"center",width:28}}>GD</td>
                          <td style={{padding:"2px 4px",textAlign:"center",width:28}}>GF</td>
                          <td style={{padding:"2px 4px",textAlign:"center",width:60}}>Status</td>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedThirds.map((t, idx) => {
                          const certain_in  = isCertainIn(t);
                          const certain_out = isCertainOut(t);
                          const border      = isBorder(t);
                          const selected    = selectedThirds.has(t.grp);
                          const rowColor    = certain_in  ? "#c8d8f0"
                                           : border && selected  ? "#f0c030"
                                           : border && !selected ? "#a07010"
                                           : "var(--text-dark)";
                          return (
                            <tr key={t.grp} style={{ borderBottom:"1px solid #0e1a2e" }}>
                              <td style={{padding:"3px 4px",color:rowColor}}>{idx+1}</td>
                              <td style={{padding:"3px 4px",color:rowColor,fontWeight:certain_in||border?700:400}}>
                                {f(t.team)} {t.team} <span style={{color:"var(--text-dark)",fontWeight:400}}>(3{t.grp})</span>
                              </td>
                              <td style={{padding:"3px 4px",textAlign:"center",color:"var(--text-dark)"}}>{t.points}</td>
                              <td style={{padding:"3px 4px",textAlign:"center",color:"var(--text-dark)"}}>{t.gd>0?"+":""}{t.gd}</td>
                              <td style={{padding:"3px 4px",textAlign:"center",color:"var(--text-dark)"}}>{t.gf}</td>
                              <td style={{padding:"3px 4px",textAlign:"center"}}>
                                {certain_in  && <span style={{color:"#4caf80",fontWeight:700}}>✓ Through</span>}
                                {certain_out && <span style={{color:"var(--text-dark)"}}>✗ Out</span>}
                                {border && (
                                  <button
                                    onClick={() => clickBorder(t.grp)}
                                    style={{
                                      fontSize:10, padding:"2px 8px", cursor:"pointer",
                                      borderRadius:12, border:"1px solid",
                                      borderColor: selected ? "#f0c030" : "#4a3a10",
                                      background:  selected ? "rgba(240,192,48,0.15)" : "transparent",
                                      color:       selected ? "#f0c030" : "#a07010",
                                      fontWeight:  selected ? 700 : 400,
                                    }}
                                  >
                                    {selected ? "✓ Selected" : "Select"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {rankedThirds.some(t => isBorder(t)) && (
                      <div style={{fontSize:11,color:"#f0c030",marginTop:6}}>
                        ⚠ These teams are identical on all criteria including FIFA ranking — only fair play (cards) can separate them. Click to manually choose which advances.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Legend */}
              <div style={{ display:"flex", gap:16, fontSize:11, flexWrap:"wrap", marginBottom:12 }}>
                <span style={{color:"#c8d8f0"}}>■ Group winner (1X)</span>
                <span style={{color:"#8ab8e8"}}>■ Runner-up (2X)</span>
                <span style={{color:"#f0c030"}}>■ 3rd place (3X)</span>
              </div>

              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",
                gap:8,
              }}>
                {r32Matches.map(({ match, home, away, homeType, awayType }) => {
                  const typeColor = t => t === "W" ? "#c8d8f0" : t === "R" ? "#8ab8e8" : "#f0c030";
                  const col = (slot, type) => typeColor(type);

                  const TeamCell = ({ slot, type, align }) => (
                    <div style={{ textAlign: align }}>
                      <div style={{ fontSize:10, color:"var(--text-dark)", marginBottom:2 }}>{slot.label}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:col(slot,type), whiteSpace:"nowrap" }}>
                        {f(slot.team)} {slot.team}
                      </div>
                    </div>
                  );

                  return (
                    <div key={match} style={{
                      background:"#0a1628", borderRadius:6, padding:"8px 12px",
                      display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:6, alignItems:"center",
                    }}>
                      <TeamCell slot={home} type={homeType} align="right" />
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:9, color:"#f0c030", fontWeight:700, letterSpacing:1 }}>{match}</div>
                        <div style={{ fontSize:11, color:"var(--text-dark)" }}>vs</div>
                      </div>
                      <TeamCell slot={away} type={awayType} align="left" />
                    </div>
                  );
                })}
              </div>

            </>
          )}
        </div>
      )}

      {/* ── Full Tournament Bracket panel ── */}
      {simTile === "bracket" && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-label">
            Full Tournament Bracket — simulated from your R32 predictions
          </div>

          {/* Source selector */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-dark)" }}>Strength source:</span>
            {[
              { key: "opta", label: "🤖 Opta Supercomputer", desc: "Win probability model" },
              { key: "fifa", label: "🌍 FIFA Ranking",       desc: "Apr 2026 official rankings" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setSimSource(opt.key)}
                style={{
                  fontSize: 12, padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                  border: "1px solid",
                  borderColor:  simSource === opt.key ? "#f0c030" : "#2a3a5a",
                  background:   simSource === opt.key ? "rgba(240,192,48,0.10)" : "transparent",
                  color:        simSource === opt.key ? "#f0c030" : "var(--text-dark)",
                  fontWeight:   simSource === opt.key ? 700 : 400,
                }}
              >
                {opt.label}
                <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>{opt.desc}</span>
              </button>
            ))}
          </div>

          {!r32Ready ? (
            <div className="notice info">
              Enter all 72 group match score predictions (My Picks → Group Scores), then open the
              Round of 32 panel above to confirm the 8 qualifying 3rd-place teams.
              The simulation will appear here once the bracket is fully resolved.
            </div>
          ) : !simResult ? (
            <div className="spinner">Simulating…</div>
          ) : (
            <>
              {/* Final ranking banner */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8, marginBottom: 20,
                background: "#070f1c", borderRadius: 8, padding: 12,
              }}>
                {[
                  { medal: "🥇", label: "Champion",   team: simResult.ranking[0] },
                  { medal: "🥈", label: "Runner-up",  team: simResult.ranking[1] },
                  { medal: "🥉", label: "3rd Place",  team: simResult.ranking[2] },
                  { medal: "4️⃣", label: "4th Place",  team: simResult.ranking[3] },
                ].map(({ medal, label, team }) => (
                  <div key={label} style={{ textAlign: "center", padding: "8px 4px" }}>
                    <div style={{ fontSize: 20 }}>{medal}</div>
                    <div style={{ fontSize: 10, color: "var(--text-dark)", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f0c030", lineHeight: 1.3 }}>
                      {f(team)} {team}
                    </div>
                  </div>
                ))}
              </div>

              {/* Round-by-round matches */}
              {[
                { label: "Round of 16",    matches: simResult.r16Matches,   winners: simResult.r16Winners    },
                { label: "Quarter-Finals", matches: simResult.qfMatches,    winners: simResult.qfWinners     },
                { label: "Semi-Finals",    matches: simResult.sfMatches,    winners: simResult.sfWinners     },
                { label: "3rd Place",      matches: [simResult.thirdPlaceMatch], winners: [simResult.ranking[2]] },
                { label: "Final",          matches: [simResult.finalMatch],  winners: [simResult.ranking[0]]  },
              ].map(({ label, matches, winners }) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
                    color: "#4caf80", fontWeight: 700, marginBottom: 6,
                  }}>
                    {label}
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 5,
                  }}>
                    {matches.map((m, i) => {
                      const winner = winners[i];
                      return (
                        <div key={i} style={{
                          background: "#0a1628", borderRadius: 6, padding: "7px 12px",
                          display: "grid", gridTemplateColumns: "1fr auto 1fr",
                          gap: 6, alignItems: "center",
                        }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{
                              fontSize: 12, fontWeight: 700,
                              color: m.home === winner ? "#f0c030" : "var(--text-dark)",
                              whiteSpace: "nowrap",
                            }}>
                              {f(m.home)} {m.home}
                              {m.home === winner && <span style={{ marginLeft: 4 }}>✓</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-dark)", textAlign: "center" }}>vs</div>
                          <div style={{ textAlign: "left" }}>
                            <div style={{
                              fontSize: 12, fontWeight: 700,
                              color: m.away === winner ? "#f0c030" : "var(--text-dark)",
                              whiteSpace: "nowrap",
                            }}>
                              {m.away === winner && <span style={{ marginRight: 4 }}>✓</span>}
                              {f(m.away)} {m.away}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Strength reference */}
              <div style={{ fontSize: 11, color: "var(--text-dark)", marginTop: 8, marginBottom: 16 }}>
                {simSource === "opta"
                  ? "Source: Opta Supercomputer — 25,000 pre-tournament simulations (win %). Stronger team always advances."
                  : "Source: FIFA Rankings April 2026. Lower-ranked (better) team always advances."}
              </div>

              {/* Apply to picks */}
              <div style={{ borderTop: "1px solid #1a2a3a", paddingTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  className="btn-save"
                  style={{ background: "#1a5c38", borderColor: "#4caf80", width: "auto", opacity: globalLocked ? 0.4 : 1 }}
                  onClick={applySimToPicks}
                  disabled={applyingPicks || globalLocked}
                >
                  {applyingPicks ? "Saving…" : "⚡ Apply simulation to my KO picks"}
                </button>
                {picksApplied && (
                  <span style={{ color: "#4caf80", fontSize: 13, fontWeight: 700 }}>
                    ✓ Picks saved! Go to My Picks to review.
                  </span>
                )}
                {globalLocked ? (
                  <span style={{ fontSize: 11, color: "var(--text-dark)" }}>
                    🔒 Picks locked — global deadline has passed.
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-dark)" }}>
                    Overwrites your current R32 → QF qualifier picks and final standings.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Next deadline reminder */}
      {nextDeadline && (
        <div className="notice amber" style={{ marginTop: 32 }}>
          ⏰ <strong>{nextDeadline.label}:</strong> {nextDeadline.date}
        </div>
      )}
    </div>
  );
}
