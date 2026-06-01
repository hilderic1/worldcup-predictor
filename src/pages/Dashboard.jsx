import { GLOBAL_DEADLINE, KO_ROUNDS } from "../constants";
import { isPast, currentOpenRound } from "../utils";

const SCORE_CATEGORIES = [
  { key: "matchPts",   label: "Group Scores",    icon: "⚽", desc: "Match result + accuracy + exact" },
  { key: "koMatchPts", label: "KO Scores",        icon: "🥊", desc: "Knockout match predictions" },
  { key: "groupPts",   label: "Group Rankings",   icon: "📊", desc: "1st, 2nd & 3rd per group" },
  { key: "r32Pts",     label: "Round of 32",      icon: "32", desc: "10 pts per correct qualifier" },
  { key: "r16Pts",     label: "Round of 16",      icon: "16", desc: "15 pts per correct qualifier" },
  { key: "qfPts",      label: "Quarter-Finals",   icon: "🏅", desc: "20 pts per correct qualifier" },
  { key: "sfPts",      label: "Semi-Finals / Final", icon: "🏆", desc: "25 pts per team + 5 pts correct rank" },
];

function ordinal(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export default function Dashboard({ player, leaderboard, leaderboardLoading, onNavigate, messages, onMarkRead }) {
  const openRound = currentOpenRound();
  const globalLocked = isPast(GLOBAL_DEADLINE);

  const myEntry = leaderboard.find(e => e.name === player?.name);
  const myRank = myEntry ? leaderboard.indexOf(myEntry) + 1 : null;
  const totalPlayers = leaderboard.length;

  const nextDeadline = !globalLocked
    ? { label: "Global deadline — all qualifying picks lock", date: "10 Jun 2026 23:59 (Portugal)" }
    : KO_ROUNDS.find(r => !isPast(r.deadline))
      ? { label: `${KO_ROUNDS.find(r => !isPast(r.deadline)).label} deadline`, date: KO_ROUNDS.find(r => !isPast(r.deadline)).deadline }
      : null;

  const unread = (messages || []).filter(m => !m.read);

  return (
    <div>
      {/* Admin messages */}
      {unread.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {unread.map(m => (
            <div key={m.id} className="notice amber" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <strong>📬 Message from Admin:</strong> {m.body}
              </div>
              <button
                style={{ flexShrink: 0, fontSize: 11, padding: "2px 10px", cursor: "pointer" }}
                onClick={() => onMarkRead(m.id)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hero */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-left">
          <div className="dashboard-greeting">Welcome back,</div>
          <div className="dashboard-player-name">{player?.name}</div>
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

      {/* Quick actions */}
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

      {/* Next deadline reminder */}
      {nextDeadline && (
        <div className="notice amber" style={{ marginTop: 32 }}>
          ⏰ <strong>{nextDeadline.label}:</strong> {nextDeadline.date}
        </div>
      )}
    </div>
  );
}
