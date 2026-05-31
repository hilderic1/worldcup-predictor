import { KO_ROUNDS } from "../constants";
import { f } from "../constants";

export default function KoMatchGrid({ round, fixtures, scores, setScores, disabled }) {
  const games = KO_ROUNDS.find(r => r.id === round)?.games || 0;

  return (
    <div className="match-list">
      {Array(games).fill(0).map((_, i) => {
        const fix = fixtures?.[i];
        const sc = scores?.[i] || {};
        const home = fix?.home || `Team ${i * 2 + 1}`;
        const away = fix?.away || `Team ${i * 2 + 2}`;
        return (
          <div key={i} className="match-row">
            <div className="team-l">{f(home)} {home}</div>
            <input
              className="score-inp"
              type="number"
              min="0"
              max="20"
              value={sc.home_score ?? ""}
              placeholder="0"
              disabled={disabled || !fix?.home}
              onChange={e => {
                const u = [...(scores || [])];
                if (!u[i]) u[i] = {};
                u[i] = { ...u[i], home_score: e.target.value };
                setScores(u);
              }}
            />
            <div className="sep">–</div>
            <input
              className="score-inp"
              type="number"
              min="0"
              max="20"
              value={sc.away_score ?? ""}
              placeholder="0"
              disabled={disabled || !fix?.home}
              onChange={e => {
                const u = [...(scores || [])];
                if (!u[i]) u[i] = {};
                u[i] = { ...u[i], away_score: e.target.value };
                setScores(u);
              }}
            />
            <div className="team-r">{away} {f(away)}</div>
          </div>
        );
      })}
    </div>
  );
}
