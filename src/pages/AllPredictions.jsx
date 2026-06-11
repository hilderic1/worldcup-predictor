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

const EMPTY_PREDS = {
  matches: {}, groupTopThree: {},
  r32: Array(32).fill(""), r16: Array(16).fill(""),
  qf: Array(8).fill(""), sfRank: Array(4).fill(""),
  koMatchPreds: {},
};

export default function AllPredictions({
  player,
  actualMatches, actualGroupTopThree,
  actualR32, actualR16, actualQF, actualSFRank,
  koFixtures, koActualScores,
}) {
  const [leftPlayer, setLeftPlayer] = useState(player || PLAYERS[0]);
  const [rightPlayer, setRightPlayer] = useState(null);
  const [activeTab, setActiveTab] = useState("group-scores");

  const [leftPreds, setLeftPreds] = useState(EMPTY_PREDS);
  const [rightPreds, setRightPreds] = useState(null);
  const [leftLoading, setLeftLoading] = useState(true);
  const [rightLoading, setRightLoading] = useState(false);

  const fetchPicks = useCallback(async (playerName) => {
    const [pm, pg, pk, pkm] = await Promise.all([
      supabase.from("match_predictions").select("*").eq("player_name", playerName),
      supabase.from("group_ranking_predictions").select("*").eq("player_name", playerName),
      supabase.from("knockout_predictions").select("*").eq("player_name", playerName),
      supabase.from("ko_match_predictions").select("*").eq("player_name", playerName),
    ]);
    const matches = {};
    (pm.data || []).forEach(r => (matches[r.match_id] = r));
    const groupTopThree = {};
    (pg.data || []).forEach(r => {
      if (Array.isArray(r.ranking))
        groupTopThree[r.group_id] = { first: r.ranking[0] || "", second: r.ranking[1] || "", third: r.ranking[2] || "" };
    });
    const kp = {};
    (pk.data || []).forEach(r => (kp[r.round] = r.teams));
    const koMatchPreds = {};
    (pkm.data || []).forEach(r => {
      if (!koMatchPreds[r.round]) koMatchPreds[r.round] = [];
      koMatchPreds[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score };
    });
    return {
      matches,
      groupTopThree,
      r32: kp["R32"] || Array(32).fill(""),
      r16: kp["R16"] || Array(16).fill(""),
      qf: kp["QF"] || Array(8).fill(""),
      sfRank: kp["SF_RANK"] || Array(4).fill(""),
      koMatchPreds,
    };
  }, []);

  useEffect(() => {
    setLeftLoading(true);
    fetchPicks(leftPlayer).then(data => { setLeftPreds(data); setLeftLoading(false); });
  }, [leftPlayer, fetchPicks]);

  useEffect(() => {
    if (!rightPlayer) { setRightPreds(null); return; }
    setRightLoading(true);
    fetchPicks(rightPlayer).then(data => { setRightPreds(data); setRightLoading(false); });
  }, [rightPlayer, fetchPicks]);

  const comparing = !!rightPlayer && !!rightPreds;

  function PlayerPill({ name, selected, onClick }) {
    return (
      <button
        className={`player-pill ${selected ? "active" : ""}`}
        style={{
          borderColor: PLAYER_COLORS[name],
          ...(selected ? { background: PLAYER_COLORS[name], color: "#070c18" } : { color: PLAYER_COLORS[name] }),
        }}
        onClick={onClick}
      >
        {name}
      </button>
    );
  }

  function ScoreBadge({ pred, actual, side }) {
    const cls = getMatchPickClass(pred, actual);
    const home = pred?.home_score ?? "–";
    const away = pred?.away_score ?? "–";
    if (side === "left") return (
      <span className={`score-badge ${cls}`} style={{ marginRight: 4 }}>{home}–{away}</span>
    );
    return (
      <span className={`score-badge ${cls}`} style={{ marginLeft: 4 }}>{home}–{away}</span>
    );
  }

  return (
    <>
      <div className="section-header">
        <div className="section-title">👁 Compare Players Picks</div>
      </div>

      {/* Player selectors */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "var(--text-dark)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
          {player ? "Your picks" : "View player"}
        </div>
        <div className="player-selector">
          {PLAYERS.map(p => (
            <PlayerPill
              key={p}
              name={p}
              selected={leftPlayer === p}
              onClick={() => {
                setLeftPlayer(p);
                if (rightPlayer === p) setRightPlayer(null);
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-dark)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
          Compare with
        </div>
        <div className="player-selector">
          <button
            className={`player-pill ${!rightPlayer ? "active" : ""}`}
            style={!rightPlayer ? { background: "#2a3a5a", color: "#ccd" } : { color: "#6a7a9a" }}
            onClick={() => setRightPlayer(null)}
          >
            None
          </button>
          {PLAYERS.filter(p => p !== leftPlayer).map(p => (
            <PlayerPill
              key={p}
              name={p}
              selected={rightPlayer === p}
              onClick={() => setRightPlayer(p)}
            />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-row">
        {[
          ["group-scores", "⚽ Group Scores"],
          ["qualifying", "🏆 Qualifying Picks"],
          ["ko-scores", "🥊 KO Scores"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={`tab ${activeTab === k ? "active" : ""}`}
            onClick={() => setActiveTab(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Compare header banner */}
      {comparing && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 16px", marginBottom: 8, borderRadius: 6,
          background: "#0e1a2e", fontSize: 13, fontWeight: 700,
        }}>
          <span style={{ color: PLAYER_COLORS[leftPlayer] }}>◀ {leftPlayer}</span>
          <span style={{ color: "var(--text-dark)", fontSize: 11 }}>vs</span>
          <span style={{ color: PLAYER_COLORS[rightPlayer] }}>{rightPlayer} ▶</span>
        </div>
      )}

      {leftLoading ? (
        <div className="spinner">Loading {leftPlayer}'s picks…</div>
      ) : (
        <>
          {/* ── GROUP MATCH SCORES ── */}
          {activeTab === "group-scores" && (
            Object.entries(GROUPS).map(([grp]) => (
              <div key={grp} className="card">
                <div className="card-label">Group {grp}</div>
                <div className="match-list">
                  {GROUP_MATCHES.filter(m => m.group === grp).map(m => {
                    const lPred = leftPreds.matches[m.id] || {};
                    const rPred = comparing ? (rightPreds.matches[m.id] || {}) : null;
                    const actual = actualMatches[m.id];
                    const lCls = getMatchPickClass(lPred, actual);
                    const rCls = rPred ? getMatchPickClass(rPred, actual) : null;
                    const lSc = actual ? scoreMatch(lPred, actual) : null;
                    const rSc = (actual && rPred) ? scoreMatch(rPred, actual) : null;
                    return (
                      <div key={m.id} className="match-row">
                        {comparing ? (
                          <>
                            <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                              <div style={{ textAlign: "right" }}>
                                <span className={`score-badge ${lCls}`} style={{ color: PLAYER_COLORS[leftPlayer] }}>
                                  {lPred.home_score ?? "–"}–{lPred.away_score ?? "–"}
                                </span>
                              </div>
                              <div style={{ textAlign: "center", fontSize: 12 }}>
                                <span style={{ color: "#8a9aba" }}>{f(m.home)} {m.home}</span>
                                <span style={{ margin: "0 6px", color: "var(--text-dark)" }}>vs</span>
                                <span style={{ color: "#8a9aba" }}>{m.away} {f(m.away)}</span>
                              </div>
                              <div style={{ textAlign: "left" }}>
                                <span className={`score-badge ${rCls}`} style={{ color: PLAYER_COLORS[rightPlayer] }}>
                                  {rPred.home_score ?? "–"}–{rPred.away_score ?? "–"}
                                </span>
                              </div>
                            </div>
                            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dark)" }}>
                              <span style={{ color: PLAYER_COLORS[leftPlayer] }}>
                                {lSc !== null ? `${lSc.total}pts` : "—"}
                              </span>
                              <span>{m.date} {m.time} UTC {actual ? `(${actual.home_score}–${actual.away_score})` : "not played"}</span>
                              <span style={{ color: PLAYER_COLORS[rightPlayer] }}>
                                {rSc !== null ? `${rSc.total}pts` : "—"}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="team-l">{f(m.home)} {m.home}</div>
                            <div className={`score-badge ${lCls}`}>{lPred.home_score ?? "–"}</div>
                            <div className="sep">–</div>
                            <div className={`score-badge ${lCls}`}>{lPred.away_score ?? "–"}</div>
                            <div className="team-r">{m.away} {f(m.away)}</div>
                            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: "#2a3a5a" }}>{m.date} {m.time} UTC</span>
                              {lSc !== null && lSc.total > 0 && <span className="match-pts">+{lSc.total}pts</span>}
                              {actual && lSc !== null && lSc.total === 0 && <span style={{ fontSize: 11, color: "var(--accent-red)", fontWeight: 600 }}>0 pts</span>}
                              {!actual && <span style={{ fontSize: 10, color: "var(--text-dark)" }}>not played yet</span>}
                            </div>
                          </>
                        )}
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
                    const lv = leftPreds.groupTopThree[grp] || { first: "", second: "", third: "" };
                    const rv = comparing ? (rightPreds.groupTopThree[grp] || { first: "", second: "", third: "" }) : null;
                    const actual = actualGroupTopThree[grp];
                    return (
                      <div key={grp} className="group-box">
                        <div className="group-box-title">Group {grp}</div>
                        {["first", "second", "third"].map((rank, i) => {
                          const lTeam = lv[rank] || "";
                          const rTeam = rv ? (rv[rank] || "") : null;
                          const lCls = getGroupRankChipClass(lTeam, rank, actual);
                          const rCls = rTeam !== null ? getGroupRankChipClass(rTeam, rank, actual) : null;
                          return (
                            <div key={rank} className="rank-row">
                              <div className="rank-num">{i + 1}</div>
                              <div className={`pick-chip ${lCls}`} style={{ flex: 1, color: comparing ? PLAYER_COLORS[leftPlayer] : undefined }}>
                                {lTeam ? <>{f(lTeam)} {lTeam}</> : <span style={{ color: "var(--text-dark)" }}>—</span>}
                              </div>
                              {comparing && (
                                <div className={`pick-chip ${rCls}`} style={{ flex: 1, color: PLAYER_COLORS[rightPlayer] }}>
                                  {rTeam ? <>{f(rTeam)} {rTeam}</> : <span style={{ color: "var(--text-dark)" }}>—</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Qualifier chips — show side by side rows when comparing */}
              {[
                { label: "R32 Qualifiers — 32 teams (10 pts each)", lArr: leftPreds.r32, rArr: comparing ? rightPreds.r32 : null, actual: actualR32 },
                { label: "R16 Qualifiers — 16 teams (15 pts each)", lArr: leftPreds.r16, rArr: comparing ? rightPreds.r16 : null, actual: actualR16 },
                { label: "Quarter-Finalists — 8 teams (20 pts each)", lArr: leftPreds.qf, rArr: comparing ? rightPreds.qf : null, actual: actualQF },
              ].map(({ label, lArr, rArr, actual }) => (
                <div key={label} className="card">
                  <div className="card-label">{label}</div>
                  {comparing && rArr ? (() => {
                    const lSet = new Set(lArr.filter(Boolean));
                    const rSet = new Set(rArr.filter(Boolean));
                    const shared = [...lSet].filter(t => rSet.has(t)).sort();
                    const lOnly = [...lSet].filter(t => !rSet.has(t)).sort();
                    const rOnly = [...rSet].filter(t => !lSet.has(t)).sort();
                    return (
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 6 }}>
                          <div style={{ fontSize: 11, color: PLAYER_COLORS[leftPlayer], fontWeight: 700 }}>{leftPlayer}</div>
                          <div style={{ fontSize: 11, color: PLAYER_COLORS[rightPlayer], fontWeight: 700 }}>{rightPlayer}</div>
                        </div>
                        {shared.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: "var(--text-dark)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Both picked</div>
                            <div className="ko-chips">
                              {shared.map(team => (
                                <div key={team} className={`pick-chip ${getQualifierChipClass(team, actual)}`}>
                                  {f(team)} {team}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {(lOnly.length > 0 || rOnly.length > 0) && (
                          <div>
                            <div style={{ fontSize: 10, color: "var(--text-dark)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Differ</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div className="ko-chips">
                                {lOnly.map(team => (
                                  <div key={team} className={`pick-chip ${getQualifierChipClass(team, actual)}`} style={{ color: PLAYER_COLORS[leftPlayer], borderColor: PLAYER_COLORS[leftPlayer] }}>
                                    {f(team)} {team}
                                  </div>
                                ))}
                              </div>
                              <div className="ko-chips">
                                {rOnly.map(team => (
                                  <div key={team} className={`pick-chip ${getQualifierChipClass(team, actual)}`} style={{ color: PLAYER_COLORS[rightPlayer], borderColor: PLAYER_COLORS[rightPlayer] }}>
                                    {f(team)} {team}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="ko-chips">
                      {lArr.map((team, i) => (
                        <div key={i} className={`pick-chip ${getQualifierChipClass(team, actual)}`}>
                          {team ? <>{f(team)} {team}</> : <span style={{ color: "var(--text-dark)" }}>#{i + 1}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Final Ranking */}
              <div className="card">
                <div className="card-label">Final standings 1st–4th (25 pts per team + 5 pts for correct rank)</div>
                {comparing && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: PLAYER_COLORS[leftPlayer], fontWeight: 700 }}>{leftPlayer}</span>
                    <span style={{ fontSize: 11, color: PLAYER_COLORS[rightPlayer], fontWeight: 700 }}>{rightPlayer}</span>
                  </div>
                )}
                <div className="sf-list">
                  {FINAL_RANKS.map((label, i) => {
                    const lTeam = leftPreds.sfRank[i] || "";
                    const rTeam = comparing ? (rightPreds.sfRank[i] || "") : null;
                    const actualSet = actualSFRank.filter(Boolean);
                    const sfCls = (team) => !team ? "pick-pending"
                      : !actualSet.length ? "pick-pending"
                      : actualSFRank[i] === team ? "pick-exact"
                      : actualSet.includes(team) ? "pick-correct"
                      : "pick-wrong";
                    return (
                      <div key={i} className="sf-row">
                        <div className="sf-rank-label">{label}</div>
                        <div className={`pick-chip ${sfCls(lTeam)}`} style={comparing ? { color: PLAYER_COLORS[leftPlayer] } : {}}>
                          {lTeam ? <>{f(lTeam)} {lTeam}</> : <span style={{ color: "var(--text-dark)" }}>—</span>}
                        </div>
                        {comparing && (
                          <div className={`pick-chip ${sfCls(rTeam)}`} style={{ color: PLAYER_COLORS[rightPlayer] }}>
                            {rTeam ? <>{f(rTeam)} {rTeam}</> : <span style={{ color: "var(--text-dark)" }}>—</span>}
                          </div>
                        )}
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
              const lRoundPreds = leftPreds.koMatchPreds[r.id] || [];
              const rRoundPreds = comparing ? (rightPreds.koMatchPreds[r.id] || []) : null;
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
                        const lPred = lRoundPreds[i] || {};
                        const rPred = rRoundPreds ? (rRoundPreds[i] || {}) : null;
                        const actual = roundActuals[i];
                        const actualHasScore = actual && actual.home_score != null;
                        const lCls = getMatchPickClass(lPred, actualHasScore ? actual : null);
                        const rCls = rPred ? getMatchPickClass(rPred, actualHasScore ? actual : null) : null;
                        const lSc = actualHasScore ? scoreMatch(lPred, actual) : null;
                        const rSc = (actualHasScore && rPred) ? scoreMatch(rPred, actual) : null;
                        return (
                          <div key={i} className="match-row">
                            {comparing ? (
                              <>
                                <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                                  <div style={{ textAlign: "right" }}>
                                    <span className={`score-badge ${lCls}`} style={{ color: PLAYER_COLORS[leftPlayer] }}>
                                      {lPred.home_score ?? "–"}–{lPred.away_score ?? "–"}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: "center", fontSize: 12 }}>
                                    <span style={{ color: "#8a9aba" }}>{f(fix.home)} {fix.home}</span>
                                    <span style={{ margin: "0 6px", color: "var(--text-dark)" }}>vs</span>
                                    <span style={{ color: "#8a9aba" }}>{fix.away} {f(fix.away)}</span>
                                  </div>
                                  <div style={{ textAlign: "left" }}>
                                    <span className={`score-badge ${rCls}`} style={{ color: PLAYER_COLORS[rightPlayer] }}>
                                      {rPred.home_score ?? "–"}–{rPred.away_score ?? "–"}
                                    </span>
                                  </div>
                                </div>
                                <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dark)" }}>
                                  <span style={{ color: PLAYER_COLORS[leftPlayer] }}>
                                    {lSc !== null ? `${lSc.total}pts` : "—"}
                                  </span>
                                  <span>{actualHasScore ? `${actual.home_score}–${actual.away_score}` : "not played"}</span>
                                  <span style={{ color: PLAYER_COLORS[rightPlayer] }}>
                                    {rSc !== null ? `${rSc.total}pts` : "—"}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="team-l">{f(fix.home)} {fix.home}</div>
                                <div className={`score-badge ${lCls}`}>{lPred.home_score ?? "–"}</div>
                                <div className="sep">–</div>
                                <div className={`score-badge ${lCls}`}>{lPred.away_score ?? "–"}</div>
                                <div className="team-r">{fix.away} {f(fix.away)}</div>
                                <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                                  {lSc !== null && lSc.total > 0 && <span className="match-pts">+{lSc.total}pts</span>}
                                  {actualHasScore && lSc !== null && lSc.total === 0 && <span style={{ fontSize: 11, color: "var(--accent-red)", fontWeight: 600 }}>0 pts</span>}
                                  {!actualHasScore && <span style={{ fontSize: 10, color: "var(--text-dark)" }}>not played yet</span>}
                                </div>
                              </>
                            )}
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
