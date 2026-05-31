import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import {
  PLAYERS, PLAYER_COLORS, GROUPS, GROUP_MATCHES, FINAL_RANKS, KO_ROUNDS, f,
} from "../constants";
import { scoreMatch } from "../utils";

function getMatchPickClass(pred, actual) {
  if (!actual || actual.home_score == null) return "pick-pending";
  if (!pred || pred.home_score == null) return "pick-empty";
  const pH = +pred.home_score, pA = +pred.away_score;
  const aH = +actual.home_score, aA = +actual.away_score;
  if (isNaN(pH) || isNaN(pA)) return "pick-empty";
  if (pH === aH && pA === aA) return "pick-exact";
  const res = (h, a) => h > a ? "H" : h < a ? "A" : "D";
  return res(pH, pA) === res(aH, aA) ? "pick-correct" : "pick-wrong";
}

function getGroupRankChipClass(team, rank, actualGroup) {
  if (!team) return "pick-pending";
  if (!actualGroup || !actualGroup.first) return "pick-pending";
  if (actualGroup[rank] === team) return "pick-exact";
  if ([actualGroup.first, actualGroup.second, actualGroup.third].includes(team)) return "pick-correct";
  return "pick-wrong";
}

function getQualifierChipClass(team, actualArr) {
  if (!team) return "pick-pending";
  if (!actualArr || !actualArr.some(Boolean)) return "pick-pending";
  return actualArr.includes(team) ? "pick-correct" : "pick-wrong";
}

export default function AllPredictions({
  actualMatches, actualGroupTopThree,
  actualR32, actualR16, actualQF, actualSFRank,
  koFixtures, koActualScores,
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(PLAYERS[0]);
  const [activeTab, setActiveTab] = useState("group-scores");
  const [loading, setLoading] = useState(true);

  const [matchPreds, setMatchPreds] = useState({});
  const [groupTopThree, setGroupTopThree] = useState({});
  const [r32Pred, setR32Pred] = useState(Array(32).fill(""));
  const [r16Pred, setR16Pred] = useState(Array(16).fill(""));
  const [qfPred, setQfPred] = useState(Array(8).fill(""));
  const [sfRankPred, setSfRankPred] = useState(Array(4).fill(""));
  const [koMatchPreds, setKoMatchPreds] = useState({});

  const loadPlayerPicks = useCallback(async (playerName) => {
    setLoading(true);
    const [pm, pg, pk, pkm] = await Promise.all([
      supabase.from("match_predictions").select("*").eq("player_name", playerName),
      supabase.from("group_ranking_predictions").select("*").eq("player_name", playerName),
      supabase.from("knockout_predictions").select("*").eq("player_name", playerName),
      supabase.from("ko_match_predictions").select("*").eq("player_name", playerName),
    ]);

    const mp = {};
    (pm.data || []).forEach(r => (mp[r.match_id] = r));
    setMatchPreds(mp);

    const gt = {};
    (pg.data || []).forEach(r => {
      if (Array.isArray(r.ranking))
        gt[r.group_id] = { first: r.ranking[0] || "", second: r.ranking[1] || "", third: r.ranking[2] || "" };
    });
    setGroupTopThree(gt);

    const kp = {};
    (pk.data || []).forEach(r => (kp[r.round] = r.teams));
    setR32Pred(kp["R32"] || Array(32).fill(""));
    setR16Pred(kp["R16"] || Array(16).fill(""));
    setQfPred(kp["QF"] || Array(8).fill(""));
    setSfRankPred(kp["SF_RANK"] || Array(4).fill(""));

    const km = {};
    (pkm.data || []).forEach(r => {
      if (!km[r.round]) km[r.round] = [];
      km[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score };
    });
    setKoMatchPreds(km);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlayerPicks(selectedPlayer);
  }, [selectedPlayer, loadPlayerPicks]);

  return (
    <>
      <div className="section-header">
        <div className="section-title">👁 Predictions</div>
      </div>

      {/* Player selector */}
      <div className="player-selector">
        {PLAYERS.map(p => (
          <button
            key={p}
            className={`player-pill ${selectedPlayer === p ? "active" : ""}`}
            style={{
              borderColor: PLAYER_COLORS[p],
              ...(selectedPlayer === p
                ? { background: PLAYER_COLORS[p], color: "#070c18" }
                : { color: PLAYER_COLORS[p] }),
            }}
            onClick={() => setSelectedPlayer(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-row">
        <button
          className={`tab ${activeTab === "group-scores" ? "active" : ""}`}
          onClick={() => setActiveTab("group-scores")}
        >
          ⚽ Group Scores
        </button>
        <button
          className={`tab ${activeTab === "qualifying" ? "active" : ""}`}
          onClick={() => setActiveTab("qualifying")}
        >
          🏆 Qualifying Picks
        </button>
        <button
          className={`tab ${activeTab === "ko-scores" ? "active" : ""}`}
          onClick={() => setActiveTab("ko-scores")}
        >
          🥊 KO Scores
        </button>
      </div>

      {loading ? (
        <div className="spinner">Loading {selectedPlayer}'s picks…</div>
      ) : (
        <>
          {/* ── GROUP MATCH SCORES ── */}
          {activeTab === "group-scores" && (
            Object.entries(GROUPS).map(([grp]) => (
              <div key={grp} className="card">
                <div className="card-label">Group {grp}</div>
                <div className="match-list">
                  {GROUP_MATCHES.filter(m => m.group === grp).map(m => {
                    const pred = matchPreds[m.id] || {};
                    const actual = actualMatches[m.id];
                    const cls = getMatchPickClass(pred, actual);
                    const sc = actual ? scoreMatch(pred, actual) : null;
                    return (
                      <div key={m.id} className="match-row">
                        <div className="team-l">{f(m.home)} {m.home}</div>
                        <div className={`score-badge ${cls}`}>{pred.home_score ?? "–"}</div>
                        <div className="sep">–</div>
                        <div className={`score-badge ${cls}`}>{pred.away_score ?? "–"}</div>
                        <div className="team-r">{m.away} {f(m.away)}</div>
                        <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: "#2a3a5a" }}>{m.date} {m.time} UTC</span>
                          {sc !== null && sc.total > 0 && (
                            <span className="match-pts">+{sc.total}pts</span>
                          )}
                          {actual && sc !== null && sc.total === 0 && (
                            <span style={{ fontSize: 11, color: "var(--accent-red)", fontWeight: 600 }}>0 pts</span>
                          )}
                          {!actual && (
                            <span style={{ fontSize: 10, color: "var(--text-dark)" }}>not played yet</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* ── QUALIFYING PICKS ── */}
          {activeTab === "qualifying" && (
            <>
              {/* Group Rankings */}
              <div className="card">
                <div className="card-label">Group Top-3 predictions</div>
                <div className="group-grid">
                  {Object.entries(GROUPS).map(([grp]) => {
                    const v = groupTopThree[grp] || { first: "", second: "", third: "" };
                    const actual = actualGroupTopThree[grp];
                    return (
                      <div key={grp} className="group-box">
                        <div className="group-box-title">Group {grp}</div>
                        {["first", "second", "third"].map((rank, i) => {
                          const team = v[rank] || "";
                          const cls = getGroupRankChipClass(team, rank, actual);
                          return (
                            <div key={rank} className="rank-row">
                              <div className="rank-num">{i + 1}</div>
                              <div className={`pick-chip ${cls}`} style={{ flex: 1 }}>
                                {team
                                  ? <>{f(team)} {team}</>
                                  : <span style={{ color: "var(--text-dark)" }}>—</span>
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* R32 Qualifiers */}
              <div className="card">
                <div className="card-label">R32 Qualifiers — 32 teams predicted (10 pts each)</div>
                <div className="ko-chips">
                  {r32Pred.map((team, i) => (
                    <div key={i} className={`pick-chip ${getQualifierChipClass(team, actualR32)}`}>
                      {team ? <>{f(team)} {team}</> : <span style={{ color: "var(--text-dark)" }}>#{i + 1}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* R16 Qualifiers */}
              <div className="card">
                <div className="card-label">R16 Qualifiers — 16 teams predicted (15 pts each)</div>
                <div className="ko-chips">
                  {r16Pred.map((team, i) => (
                    <div key={i} className={`pick-chip ${getQualifierChipClass(team, actualR16)}`}>
                      {team ? <>{f(team)} {team}</> : <span style={{ color: "var(--text-dark)" }}>#{i + 1}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* QF Qualifiers */}
              <div className="card">
                <div className="card-label">Quarter-Finalists — 8 teams predicted (20 pts each)</div>
                <div className="ko-chips">
                  {qfPred.map((team, i) => (
                    <div key={i} className={`pick-chip ${getQualifierChipClass(team, actualQF)}`}>
                      {team ? <>{f(team)} {team}</> : <span style={{ color: "var(--text-dark)" }}>#{i + 1}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Final Ranking */}
              <div className="card">
                <div className="card-label">Final standings 1st–4th (25 pts per team + 5 pts for correct rank)</div>
                <div className="sf-list">
                  {FINAL_RANKS.map((label, i) => {
                    const team = sfRankPred[i] || "";
                    const actualSet = actualSFRank.filter(Boolean);
                    const cls = !team
                      ? "pick-pending"
                      : !actualSet.length
                        ? "pick-pending"
                        : actualSFRank[i] === team
                          ? "pick-exact"
                          : actualSet.includes(team)
                            ? "pick-correct"
                            : "pick-wrong";
                    return (
                      <div key={i} className="sf-row">
                        <div className="sf-rank-label">{label}</div>
                        <div className={`pick-chip ${cls}`}>
                          {team
                            ? <>{f(team)} {team}</>
                            : <span style={{ color: "var(--text-dark)" }}>—</span>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── KO MATCH SCORES ── */}
          {activeTab === "ko-scores" && (
            KO_ROUNDS.map(r => {
              const roundFixtures = koFixtures[r.id] || [];
              const roundPreds = koMatchPreds[r.id] || [];
              const roundActuals = koActualScores[r.id] || [];
              const hasFixtures = roundFixtures.some(fx => fx?.home);
              return (
                <div key={r.id} className="card">
                  <div className="card-label">{r.label}</div>
                  {!hasFixtures ? (
                    <div style={{ color: "var(--text-dark)", fontSize: 13 }}>⏳ Fixtures not set yet</div>
                  ) : (
                    <div className="match-list">
                      {roundFixtures.map((fix, i) => {
                        if (!fix?.home) return null;
                        const pred = roundPreds[i] || {};
                        const actual = roundActuals[i];
                        const actualHasScore = actual && actual.home_score != null;
                        const cls = getMatchPickClass(pred, actualHasScore ? actual : null);
                        const sc = actualHasScore ? scoreMatch(pred, actual) : null;
                        return (
                          <div key={i} className="match-row">
                            <div className="team-l">{f(fix.home)} {fix.home}</div>
                            <div className={`score-badge ${cls}`}>{pred.home_score ?? "–"}</div>
                            <div className="sep">–</div>
                            <div className={`score-badge ${cls}`}>{pred.away_score ?? "–"}</div>
                            <div className="team-r">{fix.away} {f(fix.away)}</div>
                            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                              {sc !== null && sc.total > 0 && (
                                <span className="match-pts">+{sc.total}pts</span>
                              )}
                              {actualHasScore && sc !== null && sc.total === 0 && (
                                <span style={{ fontSize: 11, color: "var(--accent-red)", fontWeight: 600 }}>0 pts</span>
                              )}
                              {!actualHasScore && (
                                <span style={{ fontSize: 10, color: "var(--text-dark)" }}>not played yet</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </>
  );
}
