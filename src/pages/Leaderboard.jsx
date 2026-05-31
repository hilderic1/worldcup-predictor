import { useState, useMemo } from "react";
import { GLOBAL_DEADLINE, PLAYERS, PLAYER_COLORS } from "../constants";
import { isPast } from "../utils";

function ScoreHistoryChart({ history }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredPlayer, setHoveredPlayer] = useState(null);
  const [selectedPlayers, setSelectedPlayers] = useState(PLAYERS);

  // Setup dimensions
  const width = 800;
  const height = 450;
  const paddingLeft = 50;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const validHistory = useMemo(() => {
    return Array.isArray(history) ? history : [];
  }, [history]);

  // Compute maximum score
  const maxScore = useMemo(() => {
    if (validHistory.length === 0) return 10;
    const maxVal = Math.max(...validHistory.flatMap(h => Object.values(h.scores || {})), 10);
    return Math.ceil(maxVal / 10) * 10;
  }, [validHistory]);

  if (validHistory.length <= 1) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
        <div style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: 6 }}>No history data yet</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          History data will appear as matches and results are entered.
        </div>
      </div>
    );
  }

  const milestonesCount = validHistory.length;

  const getCoordinates = (milestoneIdx, score) => {
    const x = paddingLeft + (milestoneIdx / (milestonesCount - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (score / maxScore) * chartHeight;
    return { x, y };
  };

  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * width;
    
    const closestIdx = Math.round(((svgX - paddingLeft) / chartWidth) * (milestonesCount - 1));
    const boundedIdx = Math.max(0, Math.min(milestonesCount - 1, closestIdx));
    setHoveredIndex(boundedIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // horizontal grid lines (0, 20%, 40%, 60%, 80%, 100%)
  const yTicks = [];
  const ticksCount = 5;
  for (let i = 0; i <= ticksCount; i++) {
    const scoreVal = (maxScore / ticksCount) * i;
    const y = paddingTop + chartHeight - (scoreVal / maxScore) * chartHeight;
    yTicks.push({ val: scoreVal, y });
  }

  // Draw paths for selected players
  const playerPaths = PLAYERS.map(player => {
    if (!selectedPlayers.includes(player)) return null;
    
    const points = validHistory.map((m, idx) => {
      const score = m.scores[player] || 0;
      const { x, y } = getCoordinates(idx, score);
      return `${x},${y}`;
    });
    
    return {
      player,
      d: `M ${points.join(" L ")}`,
      color: PLAYER_COLORS[player] || "#ccc"
    };
  }).filter(Boolean);

  const togglePlayer = (player) => {
    if (selectedPlayers.includes(player)) {
      setSelectedPlayers(selectedPlayers.filter(p => p !== player));
    } else {
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const selectAll = () => setSelectedPlayers(PLAYERS);
  const selectNone = () => setSelectedPlayers([]);

  const hoveredMilestone = hoveredIndex !== null ? validHistory[hoveredIndex] : null;

  // Tooltip details sorted by scores
  const sortedScoresAtMilestone = hoveredMilestone
    ? PLAYERS.map(name => ({
        name,
        score: hoveredMilestone.scores[name] || 0,
        selected: selectedPlayers.includes(name)
      })).sort((a, b) => b.score - a.score)
    : [];

  return (
    <div className="chart-outer">
      <div className="chart-header">
        <div className="chart-title">📈 Historic Evolution of Player Scores</div>
        <div className="chart-controls">
          <button className="btn-xs" onClick={selectAll}>Show All</button>
          <button className="btn-xs" onClick={selectNone}>Clear All</button>
        </div>
      </div>

      <div className="chart-wrapper">
        <div className="svg-container" style={{ position: "relative" }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height="auto"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ display: "block" }}
          >
            {/* Horizontal Grid lines */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={width - paddingRight}
                  y2={tick.y}
                  stroke="var(--border-light)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={tick.val === 0 ? 0.8 : 0.4}
                />
                <text
                  x={paddingLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize={11}
                  fontWeight={500}
                >
                  {tick.val}
                </text>
              </g>
            ))}

            {/* Vertical grid lines at milestones */}
            {validHistory.map((m, idx) => {
              const x = paddingLeft + (idx / (milestonesCount - 1)) * chartWidth;
              return (
                <line
                  key={idx}
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={height - paddingBottom}
                  stroke="var(--border-light)"
                  strokeWidth={1}
                  opacity={0.1}
                />
              );
            })}

            {/* Render lines */}
            {playerPaths.map(({ player, d, color }) => {
              const isHovered = hoveredPlayer === player;
              const isAnyPlayerHovered = hoveredPlayer !== null;
              
              return (
                <g key={player}>
                  {/* Invisible thicker line for easier hover */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={15}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredPlayer(player)}
                    onMouseLeave={() => setHoveredPlayer(null)}
                  />
                  {/* Visual line */}
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? 4 : isAnyPlayerHovered ? 1.5 : 2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isHovered ? 1 : isAnyPlayerHovered ? 0.25 : 0.85}
                    style={{ transition: "stroke-width 0.15s, opacity 0.15s" }}
                    onMouseEnter={() => setHoveredPlayer(player)}
                    onMouseLeave={() => setHoveredPlayer(null)}
                  />
                </g>
              );
            })}

            {/* Highlighted player circles */}
            {playerPaths.map(({ player, color }) => {
              if (hoveredPlayer && hoveredPlayer !== player) return null;
              
              return validHistory.map((m, idx) => {
                if (hoveredIndex !== null && hoveredIndex !== idx) return null;
                if (hoveredIndex === null && milestonesCount > 15 && idx % Math.ceil(milestonesCount / 10) !== 0) return null;
                
                const score = m.scores[player] || 0;
                const { x, y } = getCoordinates(idx, score);
                
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={hoveredIndex === idx ? 5 : 3}
                    fill={color}
                    stroke="var(--bg-main)"
                    strokeWidth={1.5}
                    opacity={hoveredPlayer === player ? 1 : 0.8}
                    style={{ transition: "r 0.1s" }}
                  />
                );
              });
            })}

            {/* Interactive Scrubber line */}
            {hoveredIndex !== null && (
              <line
                x1={paddingLeft + (hoveredIndex / (milestonesCount - 1)) * chartWidth}
                y1={paddingTop}
                x2={paddingLeft + (hoveredIndex / (milestonesCount - 1)) * chartWidth}
                y2={height - paddingBottom}
                stroke="var(--accent-gold)"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                opacity={0.8}
              />
            )}

            {/* Bottom Milestone Ticks */}
            {validHistory.map((m, idx) => {
              const showLabel = 
                idx === 0 || 
                idx === milestonesCount - 1 || 
                (milestonesCount <= 8) ||
                (milestonesCount <= 16 && idx % 2 === 0) ||
                (milestonesCount > 16 && idx % Math.ceil(milestonesCount / 6) === 0);

              if (!showLabel) return null;

              const x = paddingLeft + (idx / (milestonesCount - 1)) * chartWidth;
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={height - paddingBottom}
                    x2={x}
                    y2={height - paddingBottom + 5}
                    stroke="var(--border-light)"
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={height - paddingBottom + 18}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize={10}
                    fontWeight={500}
                  >
                    {m.label.length > 10 ? m.label.substring(0, 8) + ".." : m.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* HTML Floating Tooltip overlay */}
          {hoveredIndex !== null && hoveredMilestone && (
            <div
              className="chart-tooltip"
              style={{
                position: "absolute",
                top: "20px",
                left: hoveredIndex > milestonesCount / 2 ? "20px" : "auto",
                right: hoveredIndex <= milestonesCount / 2 ? "20px" : "auto",
                width: "240px",
                backgroundColor: "rgba(11, 18, 32, 0.95)",
                border: "1px solid var(--border-light)",
                borderRadius: "12px",
                padding: "12px 14px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                pointerEvents: "none",
                zIndex: 10,
                transition: "left 0.15s ease, right 0.15s ease"
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--accent-gold)", marginBottom: "4px" }}>
                📍 {hoveredMilestone.label}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px", lineBreak: "anywhere" }}>
                {hoveredMilestone.details.join(", ")}
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {sortedScoresAtMilestone.map((item, rIdx) => (
                  <div
                    key={item.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      opacity: item.selected ? 1 : 0.35,
                      fontWeight: hoveredPlayer === item.name ? 700 : 500,
                      color: hoveredPlayer === item.name ? "#fff" : "var(--text-main)",
                      backgroundColor: hoveredPlayer === item.name ? "rgba(255,255,255,0.05)" : "transparent",
                      padding: "2px 4px",
                      borderRadius: "4px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", width: "14px" }}>
                        #{rIdx + 1}
                      </span>
                      <span
                        style={{
                          display: "inline-block",
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: PLAYER_COLORS[item.name]
                        }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>{item.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chart-legend">
        {PLAYERS.map(player => {
          const isSelected = selectedPlayers.includes(player);
          const isHovered = hoveredPlayer === player;
          return (
            <button
              key={player}
              className={`legend-item ${isSelected ? "active" : "inactive"} ${isHovered ? "highlight" : ""}`}
              style={{
                borderColor: isSelected ? PLAYER_COLORS[player] : "var(--border-light)",
                boxShadow: isHovered ? `0 0 8px ${PLAYER_COLORS[player]}40` : "none"
              }}
              onMouseEnter={() => setHoveredPlayer(player)}
              onMouseLeave={() => setHoveredPlayer(null)}
              onClick={() => togglePlayer(player)}
            >
              <span
                className="legend-color-dot"
                style={{
                  backgroundColor: isSelected ? PLAYER_COLORS[player] : "transparent",
                  borderColor: PLAYER_COLORS[player]
                }}
              />
              <span className="legend-name">{player}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Leaderboard({ leaderboard, history = [], loading, onRefresh }) {
  const [activeTab, setActiveTab] = useState("standings");
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

      <div className="tab-row" style={{ marginTop: "12px", marginBottom: "16px" }}>
        <button
          className={`tab ${activeTab === "standings" ? "active" : ""}`}
          onClick={() => setActiveTab("standings")}
        >
          📋 Latest Standings
        </button>
        <button
          className={`tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          📈 Score Evolution
        </button>
      </div>

      {loading ? (
        <div className="spinner">Calculating…</div>
      ) : activeTab === "standings" ? (
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
      ) : (
        <ScoreHistoryChart history={history} />
      )}
    </>
  );
}
