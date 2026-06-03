import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { GLOBAL_DEADLINE, KO_ROUNDS, GROUPS, GROUP_MATCHES, f } from "../constants";
import { isPast, currentOpenRound } from "../utils";

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
function sortTiedGroup(group, matches, preds) {
  if (group.length === 1) return { sorted: group, tiedTeams: new Set() };
  const h = calcH2H(group.map(t => t.team), matches, preds);

  const sorted = [...group].sort((a, b) => {
    const ah = h[a.team], bh = h[b.team];
    if (bh.points !== ah.points) return bh.points - ah.points;
    if (bh.gd     !== ah.gd)     return bh.gd     - ah.gd;
    if (bh.gf     !== ah.gf)     return bh.gf     - ah.gf;
    if (b.gd      !== a.gd)      return b.gd      - a.gd;
    if (b.gf      !== a.gf)      return b.gf      - a.gf;
    return 0; // colour tie — fair play / FIFA ranking not available
  });

  // Mark teams still equal after all available criteria
  const tiedTeams = new Set();
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const ah = h[a.team], bh = h[b.team];
    if (bh.points === ah.points && bh.gd === ah.gd && bh.gf === ah.gf &&
        b.gd === a.gd && b.gf === a.gf) {
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

// ── Component ──────────────────────────────────────────────────────────────

export default function Dashboard({ player, lastLogin, leaderboard, leaderboardLoading, onNavigate, messages, onMarkRead }) {
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

      {/* Statistics */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <div className="section-title">📈 Statistics</div>
      </div>

      <div className="card">
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
              {Object.entries(GROUPS).map(([grp, teams]) => {
                const { sorted = [], tiedTeams = new Set() } = groupStandings[grp] || {};
                const grpMatches = GROUP_MATCHES.filter(m => m.group === grp);
                const predicted  = grpMatches.filter(m => isFilled(matchPreds[m.id])).length;
                const allFilled  = predicted === grpMatches.length;

                return (
                  <div key={grp} style={{ background: "#0a1628", borderRadius: 8, padding: "10px 12px" }}>
                    {/* Group header */}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#f0c030" }}>
                        GROUP {grp}
                      </span>
                      <span style={{
                        fontSize: 10, color: allFilled ? "#4caf80" : "var(--text-dark)",
                        fontWeight: allFilled ? 700 : 400,
                      }}>
                        {predicted}/{grpMatches.length} matches
                      </span>
                    </div>

                    {/* Standings table */}
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
                          const qualifies = idx < 2; // top 2 advance (simplified)
                          const rowColor  = isTied    ? "#f0c030"
                                          : qualifies ? "#c8d8f0"
                                          : "var(--text-dark)";
                          return (
                            <tr key={row.team} style={{
                              borderBottom: "1px solid #0e1a2e",
                              background: idx === 1 ? "rgba(255,255,255,0.02)" : "transparent",
                            }}>
                              <td style={{ padding: "3px 3px", color: rowColor, fontWeight: qualifies ? 700 : 400 }}>
                                {idx + 1}
                              </td>
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
                              <td style={{ padding: "3px 3px", textAlign: "center", color: rowColor, fontWeight: 700 }}>
                                {row.points}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 11, flexWrap: "wrap" }}>
              <span style={{ color: "#c8d8f0" }}>■ Advances (top 2)</span>
              <span style={{ color: "#f0c030" }}>■ Colour tie — fair play &amp; FIFA ranking unavailable</span>
            </div>
            {anyTies && (
              <div className="notice warn" style={{ marginTop: 8, fontSize: 11 }}>
                ⚠ Some teams are tied on all available criteria. Actual resolution requires fair play scores and FIFA rankings.
              </div>
            )}
          </>
        )}
      </div>

      {/* Next deadline reminder */}
      {nextDeadline && (
        <div className="notice amber" style={{ marginTop: 32 }}>
          ⏰ <strong>{nextDeadline.label}:</strong> {nextDeadline.date}
        </div>
      )}
    </div>
  );
}
