import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import {
  GROUPS, GROUP_MATCHES, SORTED_TEAMS, FINAL_RANKS, KO_ROUNDS, GLOBAL_DEADLINE, f,
} from "../constants";
import { scoreMatch, isPast, currentOpenRound, formatDeadline } from "../utils";
import KoMatchGrid from "../components/KoMatchGrid";

export default function Picks({ player, actualMatches, actualGroupTopThree, actualR32, actualR16, actualQF, actualSFRank, koFixtures, koActualScores }) {
  const [predictTab, setPredictTab] = useState("matches");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");

  const [matchPreds, setMatchPreds] = useState({});
  const [groupTopThree, setGroupTopThree] = useState({});
  const [r32Pred, setR32Pred] = useState(Array(32).fill(""));
  const [r16Pred, setR16Pred] = useState(Array(16).fill(""));
  const [qfPred, setQfPred] = useState(Array(8).fill(""));
  const [sfRankPred, setSfRankPred] = useState(Array(4).fill(""));
  const [koMatchPreds, setKoMatchPreds] = useState({});

  const openRound    = currentOpenRound();
  const globalLocked = isPast(GLOBAL_DEADLINE);

  const loadPredictions = useCallback(async () => {
    if (!player?.name) return;
    setLoading(true);
    const [pm, pg, pk, pkm] = await Promise.all([
      supabase.from("match_predictions").select("*").eq("player_name", player.name),
      supabase.from("group_ranking_predictions").select("*").eq("player_name", player.name),
      supabase.from("knockout_predictions").select("*").eq("player_name", player.name),
      supabase.from("ko_match_predictions").select("*").eq("player_name", player.name),
    ]);
    // Pre-fill every match with 1-0 so unfilled predictions default to a home-win (10 pts)
    // rather than showing 0 pts and inflating the score when nothing is entered
    const mp = {};
    GROUP_MATCHES.forEach(m => { mp[m.id] = { home_score: 10, away_score: 10 }; });
    (pm.data || []).forEach(r => (mp[r.match_id] = { ...mp[r.match_id], ...r }));
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
  }, [player?.name]);

  useEffect(() => { loadPredictions(); }, [loadPredictions]);

  async function savePredictions() {
    setSaveState("saving");
    try {
      if (openRound === "GROUP") {
        const matchRows = Object.entries(matchPreds).map(([match_id, r]) => ({
          player_name: player.name, match_id, home_score: r.home_score, away_score: r.away_score,
        }));
        if (matchRows.length)
          await supabase.from("match_predictions").upsert(matchRows, { onConflict: "player_name,match_id" });
      }

      if (!globalLocked) {
        const groupRows = Object.entries(groupTopThree).map(([group_id, v]) => ({
          player_name: player.name, group_id, ranking: [v.first || "", v.second || "", v.third || ""],
        }));
        if (groupRows.length)
          await supabase.from("group_ranking_predictions").upsert(groupRows, { onConflict: "player_name,group_id" });

        const koRows = [
          { player_name: player.name, round: "R32", teams: r32Pred },
          { player_name: player.name, round: "R16", teams: r16Pred },
          { player_name: player.name, round: "QF", teams: qfPred },
          { player_name: player.name, round: "SF_RANK", teams: sfRankPred },
        ];
        await supabase.from("knockout_predictions").upsert(koRows, { onConflict: "player_name,round" });
      }

      const roundsToSave = (openRound !== "GROUP" && openRound !== "CLOSED") ? [openRound] : [];
      for (const round of roundsToSave) {
        const preds = koMatchPreds[round] || [];
        const koMatchRows = preds
          .map((p, i) => ({
            player_name: player.name, round, game_index: i, home_score: p?.home_score, away_score: p?.away_score,
          }))
          .filter(r => r.home_score != null);
        if (koMatchRows.length)
          await supabase.from("ko_match_predictions").upsert(koMatchRows, { onConflict: "player_name,round,game_index" });
      }

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  return (
    <>
      <div className="section-header">
        <div className="section-title">⚽ {player.name}'s Picks</div>
      </div>

      {openRound === "GROUP" && !globalLocked && (
        <div className="notice warn">
          🟢 Group stage open — predict all 72 match scores and all qualifying teams before{" "}
          <strong>10 June 2026</strong>.
        </div>
      )}
      {openRound !== "GROUP" && openRound !== "CLOSED" && (
        <div className="notice amber">
          ⚽ {KO_ROUNDS.find(r => r.id === openRound)?.label} match scores are now open. Deadline:{" "}
          {formatDeadline(
            KO_ROUNDS.find(r => r.id === openRound)?.deadline,
            KO_ROUNDS.find(r => r.id === openRound)?.tzLabel
          )}
        </div>
      )}
      {openRound === "CLOSED" && (
        <div className="notice info">🏁 Tournament complete — all predictions are locked.</div>
      )}

      <div className="legend">
        <div className="legend-title">Scoring System</div>
        <div className="legend-grid">
          <div className="legend-item"><span className="legend-chip">10</span> Correct result (W/D/L)</div>
          <div className="legend-item"><span className="legend-chip">up to 10+10</span> Goal accuracy (per team)</div>
          <div className="legend-item"><span className="legend-chip">+10</span> Exact score bonus — max 40/match</div>
          <div className="legend-item"><span className="legend-chip">5+5</span> Group top-3 per team (+ correct rank)</div>
          <div className="legend-item"><span className="legend-chip">10</span> Per R32 qualifier correctly predicted</div>
          <div className="legend-item"><span className="legend-chip">15</span> Per R16 team correctly predicted</div>
          <div className="legend-item"><span className="legend-chip">20</span> Per QF team correctly predicted</div>
          <div className="legend-item"><span className="legend-chip">25+5</span> Per SF team (+ correct final rank)</div>
        </div>
      </div>

      <div className="tab-row">
        <button
          className={`tab ${predictTab === "matches" ? "active" : ""} ${openRound !== "GROUP" ? "past" : ""}`}
          onClick={() => { if (openRound === "GROUP") setPredictTab("matches"); }}
        >
          ⚽ Group Scores
        </button>

        {["groups", "r32", "r16", "qf", "sf"].map(k => (
          <button
            key={k}
            className={`tab ${predictTab === k ? "active" : ""} ${globalLocked ? "past" : ""}`}
            onClick={() => { if (!globalLocked) setPredictTab(k); }}
          >
            {k === "groups" ? "📊 Groups" : k === "r32" ? "R32" : k === "r16" ? "R16" : k === "qf" ? "QF" : "🥇 Final"}
          </button>
        ))}

        {KO_ROUNDS.map(r => {
          const isOpen = openRound === r.id;
          return (
            <button
              key={`ko_${r.id}`}
              className={`tab ${predictTab === `ko_${r.id}` ? "active" : ""} ${!isOpen ? "past" : ""}`}
              onClick={() => { if (isOpen) setPredictTab(`ko_${r.id}`); }}
            >
              {r.id === "R32" ? "R32 Scores" : r.id === "R16" ? "R16 Scores" : r.id === "QF" ? "QF Scores" : r.id === "SF" ? "SF Scores" : "Final Scores"}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="spinner">Loading…</div>
      ) : (
        <>
          {/* GROUP MATCH SCORES */}
          {predictTab === "matches" && (
            openRound !== "GROUP"
              ? <div className="notice info">🔒 Group stage predictions are locked.</div>
              : Object.entries(GROUPS).map(([grp]) => (
                <div key={grp} className="card">
                  <div className="card-label">Group {grp}</div>
                  <div className="match-list">
                    {GROUP_MATCHES.filter(m => m.group === grp).map(m => {
                      const p = matchPreds[m.id] || {};
                      const a = actualMatches[m.id];
                      const sc = a ? scoreMatch(p, a) : null;
                      return (
                        <div key={m.id} className="match-row">
                          <div className="team-l">{f(m.home)} {m.home}</div>
                          <input
                            className="score-inp"
                            type="number" min="0" max="20"
                            value={p.home_score ?? ""} placeholder="0"
                            onChange={e => setMatchPreds(prev => ({ ...prev, [m.id]: { ...prev[m.id], home_score: e.target.value } }))}
                          />
                          <div className="sep">–</div>
                          <input
                            className="score-inp"
                            type="number" min="0" max="20"
                            value={p.away_score ?? ""} placeholder="0"
                            onChange={e => setMatchPreds(prev => ({ ...prev, [m.id]: { ...prev[m.id], away_score: e.target.value } }))}
                          />
                          <div className="team-r">{m.away} {f(m.away)}</div>
                          <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 10, color: "#2a3a5a" }}>{m.date} {m.time} UTC</span>
                            {sc !== null && (
                              <span className="match-pts">
                                +{sc.total}pts (result {sc.result} · accuracy {sc.accuracy} · exact {sc.exact})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
          )}

          {/* GROUP TOP 3 */}
          {predictTab === "groups" && (
            <div className="card">
              <div className="card-label">Predict 1st, 2nd and 3rd per group — locked at global deadline</div>
              <div className="group-grid">
                {Object.entries(GROUPS).map(([grp, teams]) => {
                  const v = groupTopThree[grp] || { first: "", second: "", third: "" };
                  return (
                    <div key={grp} className="group-box">
                      <div className="group-box-title">Group {grp}</div>
                      {["first", "second", "third"].map((rank, i) => (
                        <div key={rank} className="rank-row">
                          <div className="rank-num">{i + 1}</div>
                          <select
                            className="rank-sel"
                            disabled={globalLocked}
                            value={v[rank] || ""}
                            onChange={e => setGroupTopThree(prev => ({ ...prev, [grp]: { ...prev[grp], [rank]: e.target.value } }))}
                          >
                            <option value="">— pick —</option>
                            {[...teams].sort((a, b) => a.localeCompare(b)).map(t => (
                              <option key={t} value={t}>{f(t)} {t}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* R32 QUALIFIERS */}
          {predictTab === "r32" && (() => {
            const dupes = new Set(r32Pred.filter((t, i) => t && r32Pred.indexOf(t) !== i));
            return (
              <div className="card">
                <div className="card-label">All 32 R32 qualifiers — 10pts per correct team — locked at global deadline</div>
                {dupes.size > 0 && (
                  <div className="notice warn" style={{ marginBottom: 12 }}>
                    ⚠ Duplicate teams: <strong>{[...dupes].join(", ")}</strong>. Each team can only appear once.
                  </div>
                )}
                <div className="ko-grid">
                  {Array(32).fill(0).map((_, i) => (
                    <select
                      key={i}
                      className="rank-sel"
                      disabled={globalLocked}
                      value={r32Pred[i] || ""}
                      style={dupes.has(r32Pred[i]) ? { borderColor: "#cc3333", background: "#2a0a0a" } : {}}
                      onChange={e => { const u = [...r32Pred]; u[i] = e.target.value; setR32Pred(u); }}
                    >
                      <option value="">— pick {i + 1} —</option>
                      {SORTED_TEAMS.map(t => <option key={t} value={t}>{f(t)} {t}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* R16 QUALIFIERS */}
          {predictTab === "r16" && (() => {
            const dupes = new Set(r16Pred.filter((t, i) => t && r16Pred.indexOf(t) !== i));
            return (
              <div className="card">
                <div className="card-label">16 R16 qualifiers — 15pts per correct team — locked at global deadline</div>
                {dupes.size > 0 && (
                  <div className="notice warn" style={{ marginBottom: 12 }}>
                    ⚠ Duplicate teams: <strong>{[...dupes].join(", ")}</strong>. Each team can only appear once.
                  </div>
                )}
                <div className="ko-grid">
                  {Array(16).fill(0).map((_, i) => (
                    <select
                      key={i}
                      className="rank-sel"
                      disabled={globalLocked}
                      value={r16Pred[i] || ""}
                      style={dupes.has(r16Pred[i]) ? { borderColor: "#cc3333", background: "#2a0a0a" } : {}}
                      onChange={e => { const u = [...r16Pred]; u[i] = e.target.value; setR16Pred(u); }}
                    >
                      <option value="">— pick {i + 1} —</option>
                      {SORTED_TEAMS.map(t => <option key={t} value={t}>{f(t)} {t}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* QF QUALIFIERS */}
          {predictTab === "qf" && (() => {
            const dupes = new Set(qfPred.filter((t, i) => t && qfPred.indexOf(t) !== i));
            return (
              <div className="card">
                <div className="card-label">8 Quarter-Finalists — 20pts per correct team — locked at global deadline</div>
                {dupes.size > 0 && (
                  <div className="notice warn" style={{ marginBottom: 12 }}>
                    ⚠ Duplicate teams: <strong>{[...dupes].join(", ")}</strong>. Each team can only appear once.
                  </div>
                )}
                <div className="ko-grid">
                  {Array(8).fill(0).map((_, i) => (
                    <select
                      key={i}
                      className="rank-sel"
                      disabled={globalLocked}
                      value={qfPred[i] || ""}
                      style={dupes.has(qfPred[i]) ? { borderColor: "#cc3333", background: "#2a0a0a" } : {}}
                      onChange={e => { const u = [...qfPred]; u[i] = e.target.value; setQfPred(u); }}
                    >
                      <option value="">— pick {i + 1} —</option>
                      {SORTED_TEAMS.map(t => <option key={t} value={t}>{f(t)} {t}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* FINAL RANKING */}
          {predictTab === "sf" && (() => {
            const dupes = new Set(sfRankPred.filter((t, i) => t && sfRankPred.indexOf(t) !== i));
            return (
              <div className="card">
                <div className="card-label">Final standings 1st–4th — 25pts per team + 5pts correct rank — locked at global deadline</div>
                {dupes.size > 0 && (
                  <div className="notice warn" style={{ marginBottom: 12 }}>
                    ⚠ Duplicate teams: <strong>{[...dupes].join(", ")}</strong>. Each team can only appear once.
                  </div>
                )}
                <div className="sf-list">
                  {FINAL_RANKS.map((label, i) => (
                    <div key={i} className="sf-row">
                      <div className="sf-rank-label">{label}</div>
                      <select
                        className="rank-sel"
                        style={{ maxWidth: 220, ...(dupes.has(sfRankPred[i]) ? { borderColor: "#cc3333", background: "#2a0a0a" } : {}) }}
                        disabled={globalLocked}
                        value={sfRankPred[i] || ""}
                        onChange={e => { const u = [...sfRankPred]; u[i] = e.target.value; setSfRankPred(u); }}
                      >
                        <option value="">— pick team —</option>
                        {SORTED_TEAMS.map(t => <option key={t} value={t}>{f(t)} {t}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* KO ROUND MATCH SCORES */}
          {KO_ROUNDS.map(r => predictTab === `ko_${r.id}` && (
            <div key={r.id} className="card">
              <div className="card-label">
                {r.label} — predict scores — deadline: {formatDeadline(r.deadline, r.tzLabel)}
              </div>
              {!(koFixtures[r.id] || []).some(fx => fx?.home) && (
                <div className="notice info">⏳ Admin hasn't entered the fixtures for this round yet.</div>
              )}
              <KoMatchGrid
                round={r.id}
                fixtures={koFixtures[r.id]}
                scores={koMatchPreds[r.id]}
                setScores={s => setKoMatchPreds(prev => ({ ...prev, [r.id]: s }))}
                disabled={openRound !== r.id}
              />
            </div>
          ))}

          <div className="save-row">
            <button
              className={`btn-save ${saveState === "saved" ? "saved" : ""}`}
              disabled={saveState === "saving"}
              onClick={savePredictions}
            >
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved!" : "Save Predictions"}
            </button>
            {saveState === "error" && (
              <span style={{ color: "#cc3333", fontSize: 12 }}>Save failed — check your connection</span>
            )}
          </div>
        </>
      )}
    </>
  );
}
