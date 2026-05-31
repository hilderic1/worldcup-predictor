import { GLOBAL_DEADLINE } from "../constants";
import { isPast } from "../utils";

export default function Leaderboard({ leaderboard, loading, onRefresh }) {
  const globalLocked = isPast(GLOBAL_DEADLINE);

  return (
    <>
      <div className="section-header">
        <div className="section-title">🏆 Leaderboard</div>
        <button className="btn-sm" onClick={onRefresh}>↻ Refresh</button>
      </div>

      {!globalLocked && (
        <div className="notice info">
          👁 Qualifying predictions hidden until global deadline passes.
        </div>
      )}

      {loading ? (
        <div className="spinner">Calculating…</div>
      ) : (
        <div className="lb-list">
          {leaderboard.map((e, idx) => (
            <div
              key={e.name}
              className={`lb-row ${idx === 0 ? "r1" : idx === 1 ? "r2" : idx === 2 ? "r3" : ""}`}
            >
              <div className={`lb-pos p${idx < 3 ? idx + 1 : "n"}`}>{idx + 1}</div>
              <div style={{ flex: 1 }}>
                <div className="lb-name">{e.name}</div>
                <div className="lb-breakdown">
                  Groups {e.matchPts + e.koMatchPts} · Top-3 {e.groupPts} · R32 {e.r32Pts} · R16 {e.r16Pts} · QF {e.qfPts} · SF/Final {e.sfPts}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="lb-pts">{e.total}</div>
                <div className="lb-lbl">pts</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
