import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import {
  PLAYERS, GROUPS, KO_ROUNDS, SORTED_TEAMS, FINAL_RANKS, ALL_TEAMS, f,
  GLOBAL_DEADLINE, GROUP_MATCHES,
} from "./constants";
import {
  calcTotalScore, isPast, currentOpenRound, formatDeadline,
  scoreMatch, scoreGroupTopThree, scoreKOQualifiers, scoreSFRanking
} from "./utils";
import KoMatchGrid from "./components/KoMatchGrid";
import Dashboard from "./pages/Dashboard";
import Picks from "./pages/Picks";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import AllPredictions from "./pages/AllPredictions";
import "./App.css";

const SESSION_KEY = "wc_session";

export default function App() {
  const [player, setPlayer] = useState(null);
  const [view, setView] = useState("login");
  const [loginError, setLoginError] = useState("");
  const [restoringSession, setRestoringSession] = useState(() => !!localStorage.getItem(SESSION_KEY));

  // Shared actuals (loaded once, passed as props to pages that need them)
  const [actualMatches, setActualMatches] = useState({});
  const [actualGroupTopThree, setActualGroupTopThree] = useState({});
  const [actualR32, setActualR32] = useState(Array(32).fill(""));
  const [actualR16, setActualR16] = useState(Array(16).fill(""));
  const [actualQF, setActualQF] = useState(Array(8).fill(""));
  const [actualSFRank, setActualSFRank] = useState(Array(4).fill(""));
  const [koFixtures, setKoFixtures] = useState({});
  const [koActualScores, setKoActualScores] = useState({});

  // Leaderboard (computed on demand, shared with Dashboard + Leaderboard page)
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardHistory, setLeaderboardHistory] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Picks reveal — true once global deadline passes AND all players have fully submitted
  const [allPicksRevealed, setAllPicksRevealed] = useState(() => isPast(GLOBAL_DEADLINE));

  // Messages (for logged-in non-admin player)
  const [messages, setMessages] = useState([]);

  // Admin nudge tab state
  const [nudgeData, setNudgeData] = useState(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeSent, setNudgeSent] = useState({});

  // Admin UI state
  const [adminTab, setAdminTab] = useState("fixtures");
  const [saveState, setSaveState] = useState("idle");

  const openRound = currentOpenRound();

  // ── LOAD ACTUALS ──
  const loadActuals = useCallback(async () => {
    const [rm, rg, rk, rf, rs] = await Promise.all([
      supabase.from("actual_results").select("*"),
      supabase.from("actual_group_rankings").select("*"),
      supabase.from("actual_knockout").select("*"),
      supabase.from("ko_fixtures").select("*"),
      supabase.from("ko_actual_scores").select("*"),
    ]);
    const am = {};
    (rm.data || []).forEach(r => (am[r.match_id] = r));
    setActualMatches(am);

    const ag = {};
    (rg.data || []).forEach(r => {
      if (Array.isArray(r.ranking))
        ag[r.group_id] = { first: r.ranking[0] || "", second: r.ranking[1] || "", third: r.ranking[2] || "" };
    });
    setActualGroupTopThree(ag);

    const ak = {};
    (rk.data || []).forEach(r => (ak[r.round] = r.teams));
    setActualR32(ak["R32"] || Array(32).fill(""));
    setActualR16(ak["R16"] || Array(16).fill(""));
    setActualQF(ak["QF"] || Array(8).fill(""));
    setActualSFRank(ak["SF_RANK"] || Array(4).fill(""));

    const fx = {};
    (rf.data || []).forEach(r => {
      if (!fx[r.round]) fx[r.round] = [];
      fx[r.round][r.game_index] = { home: r.home_team, away: r.away_team };
    });
    setKoFixtures(fx);

    const ks = {};
    (rs.data || []).forEach(r => {
      if (!ks[r.round]) ks[r.round] = [];
      ks[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score };
    });
    setKoActualScores(ks);
  }, []);

  useEffect(() => { loadActuals(); }, [loadActuals]);

  // ── PICKS REVEAL CHECK ──
  // Requires global deadline passed AND all players have completed all three prediction tables:
  // - All 72 group match scores (match_predictions)
  // - All 12 group rankings (group_ranking_predictions)
  // - All 4 KO qualifier rounds: R32, R16, QF, SF_RANK (knockout_predictions)
  const checkPicksRevealed = useCallback(async () => {
    if (!isPast(GLOBAL_DEADLINE)) { setAllPicksRevealed(false); return; }
    const [pm, pg, pk] = await Promise.all([
      supabase.from("match_predictions").select("player_name, home_score, away_score"),
      supabase.from("group_ranking_predictions").select("player_name, group_id, ranking"),
      supabase.from("knockout_predictions").select("player_name, round"),
    ]);
    const complete = PLAYERS.every(name => {
      const matchCount = (pm.data || []).filter(r =>
        r.player_name === name && r.home_score != null && r.away_score != null
      ).length;
      if (matchCount < GROUP_MATCHES.length) return false;
      const groupCount = (pg.data || []).filter(r =>
        r.player_name === name && Array.isArray(r.ranking) && r.ranking.filter(Boolean).length >= 3
      ).length;
      if (groupCount < Object.keys(GROUPS).length) return false;
      const koMap = {};
      (pk.data || []).filter(r => r.player_name === name).forEach(r => {
        koMap[r.round] = (r.teams || []).filter(Boolean).length;
      });
      return koMap["R32"] >= 32 && koMap["R16"] >= 16 && koMap["QF"] >= 8 && koMap["SF_RANK"] >= 4;
    });
    setAllPicksRevealed(complete);
  }, []);

  useEffect(() => {
    if (player && !allPicksRevealed) checkPicksRevealed();
  }, [player, allPicksRevealed, checkPicksRevealed]);

  // ── LEADERBOARD ──
  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    const [pm, pg, pk, pkm, rm, rg, rk, rs] = await Promise.all([
      supabase.from("match_predictions").select("*"),
      supabase.from("group_ranking_predictions").select("*"),
      supabase.from("knockout_predictions").select("*"),
      supabase.from("ko_match_predictions").select("*"),
      supabase.from("actual_results").select("*"),
      supabase.from("actual_group_rankings").select("*"),
      supabase.from("actual_knockout").select("*"),
      supabase.from("ko_actual_scores").select("*"),
    ]);
    const scores = PLAYERS.map(name => {
      const preds = { matches: {}, groupTopThree: {}, r32: null, r16: null, qf: null, sfRanking: null, koMatches: {} };
      (pm.data || []).filter(r => r.player_name === name).forEach(r => (preds.matches[r.match_id] = r));
      (pg.data || []).filter(r => r.player_name === name).forEach(r => {
        if (Array.isArray(r.ranking))
          preds.groupTopThree[r.group_id] = { first: r.ranking[0] || "", second: r.ranking[1] || "", third: r.ranking[2] || "" };
      });
      (pk.data || []).filter(r => r.player_name === name).forEach(r => {
        if (r.round === "R32") preds.r32 = r.teams;
        if (r.round === "R16") preds.r16 = r.teams;
        if (r.round === "QF") preds.qf = r.teams;
        if (r.round === "SF_RANK") preds.sfRanking = r.teams;
      });
      (pkm.data || []).filter(r => r.player_name === name).forEach(r => {
        if (!preds.koMatches[r.round]) preds.koMatches[r.round] = [];
        preds.koMatches[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score };
      });
      const actuals = {
        matches: actualMatches, groupTopThree: actualGroupTopThree,
        r32: actualR32, r16: actualR16, qf: actualQF, sfRanking: actualSFRank,
        koMatches: koActualScores,
      };
      return { name, ...calcTotalScore(preds, actuals) };
    });
    scores.sort((a, b) => b.total - a.total);
    setLeaderboard(scores);

    // ── SCORE HISTORY EVOLUTION ──
    const parseUpdatedAt = (val, fallback) => {
      if (!val) return new Date(fallback).getTime();
      const t = new Date(val).getTime();
      return isNaN(t) ? new Date(fallback).getTime() : t;
    };

    const playerPredictions = {};
    PLAYERS.forEach(name => {
      const preds = { matches: {}, groupTopThree: {}, r32: null, r16: null, qf: null, sfRanking: null, koMatches: {} };
      (pm.data || []).filter(r => r.player_name === name).forEach(r => (preds.matches[r.match_id] = r));
      (pg.data || []).filter(r => r.player_name === name).forEach(r => {
        if (Array.isArray(r.ranking))
          preds.groupTopThree[r.group_id] = { first: r.ranking[0] || "", second: r.ranking[1] || "", third: r.ranking[2] || "" };
      });
      (pk.data || []).filter(r => r.player_name === name).forEach(r => {
        if (r.round === "R32") preds.r32 = r.teams;
        if (r.round === "R16") preds.r16 = r.teams;
        if (r.round === "QF") preds.qf = r.teams;
        if (r.round === "SF_RANK") preds.sfRanking = r.teams;
      });
      (pkm.data || []).filter(r => r.player_name === name).forEach(r => {
        if (!preds.koMatches[r.round]) preds.koMatches[r.round] = [];
        preds.koMatches[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score };
      });
      playerPredictions[name] = preds;
    });

    const events = [];

    // 1. Group matches from actual_results
    (rm.data || []).forEach(r => {
      if (r.home_score != null && r.away_score != null) {
        const m = GROUP_MATCHES.find(x => x.id === r.match_id);
        const fallbackDate = m ? `2026-${m.date.split('/')[0].padStart(2, '0')}-${m.date.split('/')[1].padStart(2, '0')}T${m.time}:00` : '2026-06-11T00:00:00Z';
        events.push({
          id: `match_${r.match_id}`,
          type: 'match',
          match_id: r.match_id,
          home_score: r.home_score,
          away_score: r.away_score,
          updated_at: parseUpdatedAt(r.updated_at, fallbackDate),
          label: `Match ${r.match_id} (${r.home_score}-${r.away_score})`,
          detail: `Group ${m?.group || ''}: ${r.home_score} - ${r.away_score}`
        });
      }
    });

    // 2. Knockout matches from ko_actual_scores
    (rs.data || []).forEach(r => {
      if (r.home_score != null && r.away_score != null) {
        const roundObj = KO_ROUNDS.find(x => x.id === r.round);
        const fallbackDate = roundObj ? roundObj.deadline : '2026-06-28T00:00:00Z';
        events.push({
          id: `ko_match_${r.round}_${r.game_index}`,
          type: 'ko_match',
          round: r.round,
          game_index: r.game_index,
          home_score: r.home_score,
          away_score: r.away_score,
          updated_at: parseUpdatedAt(r.updated_at, fallbackDate),
          label: `${r.round} Match ${r.game_index + 1} (${r.home_score}-${r.away_score})`,
          detail: `${roundObj?.label || r.round}: Game ${r.game_index + 1}`
        });
      }
    });

    // 3. Group rankings from actual_group_rankings
    (rg.data || []).forEach(r => {
      if (Array.isArray(r.ranking) && r.ranking.length > 0) {
        events.push({
          id: `group_ranking_${r.group_id}`,
          type: 'group_ranking',
          group_id: r.group_id,
          ranking: r.ranking,
          updated_at: parseUpdatedAt(r.updated_at, '2026-06-25T00:00:00Z'),
          label: `Group ${r.group_id} Ranking`,
          detail: `Group ${r.group_id} final ranking decided`
        });
      }
    });

    // 4. Knockout qualifiers from actual_knockout
    (rk.data || []).forEach(r => {
      if (Array.isArray(r.teams) && r.teams.length > 0) {
        const roundObj = KO_ROUNDS.find(x => x.id === r.round);
        const fallbackDate = roundObj ? roundObj.deadline : '2026-06-28T00:00:00Z';
        events.push({
          id: `knockout_${r.round}`,
          type: 'knockout',
          round: r.round,
          teams: r.teams,
          updated_at: parseUpdatedAt(r.updated_at, fallbackDate),
          label: `${r.round} Teams`,
          detail: `${roundObj?.label || r.round} teams verified`
        });
      }
    });

    events.sort((a, b) => a.updated_at - b.updated_at);

    const milestones = [];
    let currentMilestone = null;

    events.forEach(e => {
      if (!currentMilestone || Math.abs(e.updated_at - currentMilestone.timestamp) > 5 * 60 * 1000) { // 5 minutes window
        currentMilestone = {
          timestamp: e.updated_at,
          events: [e],
          label: e.label,
          details: [e.detail || e.label]
        };
        milestones.push(currentMilestone);
      } else {
        currentMilestone.events.push(e);
        currentMilestone.details.push(e.detail || e.label);
        if (currentMilestone.events.length === 2) {
          currentMilestone.label = `${currentMilestone.events[0].label.split(' (')[0]} & ${e.label.split(' (')[0]}`;
        } else if (currentMilestone.events.length > 2) {
          currentMilestone.label = `${currentMilestone.events[0].label.split(' (')[0]} + ${currentMilestone.events.length - 1} more`;
        }
      }
    });

    const getEventPoints = (playerPreds, event) => {
      if (event.type === 'match') {
        const pred = playerPreds.matches?.[event.match_id];
        return scoreMatch(pred, event).total;
      }
      if (event.type === 'ko_match') {
        const pred = playerPreds.koMatches?.[event.round]?.[event.game_index];
        return scoreMatch(pred, event).total;
      }
      if (event.type === 'group_ranking') {
        const pred = playerPreds.groupTopThree?.[event.group_id];
        const actual = {
          first: event.ranking[0] || "",
          second: event.ranking[1] || "",
          third: event.ranking[2] || ""
        };
        return scoreGroupTopThree(pred, actual);
      }
      if (event.type === 'knockout') {
        if (event.round === 'R32') return scoreKOQualifiers(playerPreds.r32, event.teams, 10);
        if (event.round === 'R16') return scoreKOQualifiers(playerPreds.r16, event.teams, 15);
        if (event.round === 'QF') return scoreKOQualifiers(playerPreds.qf, event.teams, 20);
        if (event.round === 'SF_RANK') return scoreSFRanking(playerPreds.sfRanking, event.teams);
      }
      return 0;
    };

    const history = [];
    const initialScores = {};
    PLAYERS.forEach(name => {
      initialScores[name] = 0;
    });

    history.push({
      timestamp: 0,
      label: "Start",
      details: ["Tournament begins!"],
      scores: initialScores
    });

    const currentScores = { ...initialScores };
    milestones.forEach(m => {
      const milestoneScores = {};
      PLAYERS.forEach(name => {
        let milestonePts = 0;
        const preds = playerPredictions[name];
        m.events.forEach(e => {
          milestonePts += getEventPoints(preds, e);
        });
        currentScores[name] += milestonePts;
        milestoneScores[name] = currentScores[name];
      });
      history.push({
        timestamp: m.timestamp,
        label: m.label,
        details: m.details,
        scores: milestoneScores
      });
    });

    setLeaderboardHistory(history);
    setLeaderboardLoading(false);
  }, [actualMatches, actualGroupTopThree, actualR32, actualR16, actualQF, actualSFRank, koActualScores]);

  // ── MESSAGES ──
  const loadMessages = useCallback(async (playerName) => {
    const { data } = await supabase.from("messages").select("*")
      .eq("to_player", playerName).order("created_at", { ascending: false });
    setMessages(data || []);
  }, []);

  async function markMessageRead(id) {
    await supabase.from("messages").update({ read: true }).eq("id", id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
  }

  // ── ADMIN NUDGE ──
  const loadNudgeData = useCallback(async () => {
    setNudgeLoading(true);
    const [pm, pg, pk] = await Promise.all([
      supabase.from("match_predictions").select("player_name, home_score, away_score"),
      supabase.from("group_ranking_predictions").select("player_name, group_id, ranking"),
      supabase.from("knockout_predictions").select("player_name, round, teams"),
    ]);
    const data = PLAYERS.map(name => {
      const matchDone = (pm.data || []).filter(r =>
        r.player_name === name && r.home_score != null && r.away_score != null
      ).length;
      const groupDone = (pg.data || []).filter(r =>
        r.player_name === name && Array.isArray(r.ranking) && r.ranking.filter(Boolean).length >= 3
      ).length;
      const koMap = {};
      (pk.data || []).filter(r => r.player_name === name).forEach(r => {
        koMap[r.round] = (r.teams || []).filter(Boolean).length;
      });
      return {
        name,
        groupScores: { done: matchDone, total: GROUP_MATCHES.length },
        groupRankings: { done: groupDone, total: Object.keys(GROUPS).length },
        r32: { done: koMap["R32"] || 0, total: 32 },
        r16: { done: koMap["R16"] || 0, total: 16 },
        qf:  { done: koMap["QF"]  || 0, total: 8 },
        sf:  { done: koMap["SF_RANK"] || 0, total: 4 },
      };
    });
    setNudgeData(data);
    setNudgeLoading(false);
  }, []);

  async function sendNudge(playerData) {
    const missing = [];
    if (playerData.groupScores.done < playerData.groupScores.total)
      missing.push(`Group Scores (${playerData.groupScores.done}/${playerData.groupScores.total} done)`);
    if (playerData.groupRankings.done < playerData.groupRankings.total)
      missing.push(`Group Rankings (${playerData.groupRankings.done}/${playerData.groupRankings.total} done)`);
    if (playerData.r32.done < playerData.r32.total)
      missing.push(`R32 qualifier picks (${playerData.r32.done}/${playerData.r32.total} done)`);
    if (playerData.r16.done < playerData.r16.total)
      missing.push(`R16 qualifier picks (${playerData.r16.done}/${playerData.r16.total} done)`);
    if (playerData.qf.done < playerData.qf.total)
      missing.push(`QF qualifier picks (${playerData.qf.done}/${playerData.qf.total} done)`);
    if (playerData.sf.done < playerData.sf.total)
      missing.push(`Final ranking pick (${playerData.sf.done}/${playerData.sf.total} done)`);
    if (missing.length === 0) return;
    const body = `Hi ${playerData.name}! Friendly reminder to complete your predictions before 10 June 23:59 (Portugal time). Still missing: ${missing.join(", ")}. Good luck! 🏆`;
    await supabase.from("messages").insert({ to_player: playerData.name, body });
    setNudgeSent(prev => ({ ...prev, [playerData.name]: true }));
  }

  // ── LOGIN ──
  const signIn = useCallback(async (name, password) => {
    const { data, error } = await supabase
      .from("players").select("*")
      .eq("name", name).eq("password_hash", password).single();
    if (error || !data) return false;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ name, password }));
    setPlayer(data);
    if (data.is_admin) {
      setView("admin");
    } else {
      setView("dashboard");
      loadLeaderboard();
      loadMessages(data.name);
    }
    return true;
  }, [loadLeaderboard]);

  useEffect(() => {
    (async () => {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        try {
          const { name, password } = JSON.parse(raw);
          if (!(await signIn(name, password))) localStorage.removeItem(SESSION_KEY);
        } catch {
          localStorage.removeItem(SESSION_KEY);
        }
      }
      setRestoringSession(false);
    })();
  }, [signIn]);

  async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    setLoginError("");
    if (!(await signIn(form.name.value, form.password.value))) {
      setLoginError("Wrong name or password.");
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setPlayer(null);
    setLeaderboard([]);
    setView("login");
  }

  function navigateTo(page) {
    if (page === "leaderboard") loadLeaderboard();
    if (page === "dashboard" && leaderboard.length === 0) loadLeaderboard();
    setView(page);
  }

  // ── SAVE ACTUALS (admin) ──
  async function saveActuals() {
    setSaveState("saving");
    try {
      const matchRows = Object.entries(actualMatches).map(([match_id, r]) => ({
        match_id, home_score: r.home_score, away_score: r.away_score,
      }));
      if (matchRows.length)
        await supabase.from("actual_results").upsert(matchRows, { onConflict: "match_id" });

      const groupRows = Object.entries(actualGroupTopThree).map(([group_id, v]) => ({
        group_id, ranking: [v.first || "", v.second || "", v.third || ""],
      }));
      if (groupRows.length)
        await supabase.from("actual_group_rankings").upsert(groupRows, { onConflict: "group_id" });

      const koRows = [
        { round: "R32", teams: actualR32 },
        { round: "R16", teams: actualR16 },
        { round: "QF", teams: actualQF },
        { round: "SF_RANK", teams: actualSFRank },
      ];
      await supabase.from("actual_knockout").upsert(koRows, { onConflict: "round" });

      const fixtureRows = [];
      Object.entries(koFixtures).forEach(([round, games]) => {
        (games || []).forEach((g, i) => {
          if (g?.home || g?.away)
            fixtureRows.push({ round, game_index: i, home_team: g.home || "", away_team: g.away || "" });
        });
      });
      if (fixtureRows.length)
        await supabase.from("ko_fixtures").upsert(fixtureRows, { onConflict: "round,game_index" });

      const koScoreRows = [];
      Object.entries(koActualScores).forEach(([round, games]) => {
        (games || []).forEach((g, i) => {
          if (g?.home_score != null)
            koScoreRows.push({ round, game_index: i, home_score: g.home_score, away_score: g.away_score });
        });
      });
      if (koScoreRows.length)
        await supabase.from("ko_actual_scores").upsert(koScoreRows, { onConflict: "round,game_index" });

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  // ── RENDER ──
  return (
    <div>
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            ⚽ PREDICT<span>OR</span>{" "}
            <span style={{ fontSize: 12, color: "#1e2e4a", letterSpacing: 1 }}>WC2026</span>
          </div>
          <nav className="nav">
            {player && <span className="nav-user">👤 {player.name}</span>}
            {player && !player.is_admin && (
              <>
                <button
                  className={`nav-pill ${view === "dashboard" ? "active" : ""}`}
                  onClick={() => navigateTo("dashboard")}
                >
                  Dashboard
                </button>
                <button
                  className={`nav-pill ${view === "picks" ? "active" : ""}`}
                  onClick={() => navigateTo("picks")}
                >
                  My Picks
                </button>
                <button
                  className={`nav-pill ${view === "leaderboard" ? "active" : ""}`}
                  onClick={() => navigateTo("leaderboard")}
                >
                  Leaderboard
                </button>
                <button
                  className={`nav-pill ${view === "profile" ? "active" : ""}`}
                  onClick={() => navigateTo("profile")}
                >
                  Profile
                </button>
                {allPicksRevealed && (
                  <button
                    className={`nav-pill ${view === "predictions" ? "active" : ""}`}
                    onClick={() => navigateTo("predictions")}
                  >
                    👁 Predictions
                  </button>
                )}
              </>
            )}
            {player?.is_admin && (
              <>
                <button
                  className={`nav-pill ${view === "admin" ? "active" : ""}`}
                  onClick={() => setView("admin")}
                >
                  Admin
                </button>
                <button
                  className={`nav-pill ${view === "leaderboard" ? "active" : ""}`}
                  onClick={() => navigateTo("leaderboard")}
                >
                  Leaderboard
                </button>
                {allPicksRevealed && (
                  <button
                    className={`nav-pill ${view === "predictions" ? "active" : ""}`}
                    onClick={() => navigateTo("predictions")}
                  >
                    👁 Predictions
                  </button>
                )}
              </>
            )}
            {player && (
              <button className="nav-pill" onClick={logout}>Exit</button>
            )}
          </nav>
        </div>
      </header>

      <div className="main">

        {/* LOGIN */}
        {view === "login" && !restoringSession && (
          <div className="login-outer">
            <div className="login-box">
              <div className="login-logo">⚽ WC 2026</div>
              <div className="login-sub">Select your name and enter your password</div>
              {loginError && <div className="login-error">⚠ {loginError}</div>}
              <form onSubmit={handleLogin}>
                <div className="field">
                  <label>Name</label>
                  <select name="name" required>
                    <option value="">— select —</option>
                    {[...PLAYERS, "Admin"].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Password</label>
                  <input name="password" type="password" placeholder="Your password" required />
                </div>
                <button className="btn-primary" type="submit">Enter →</button>
              </form>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {view === "dashboard" && player && !player.is_admin && (
          <Dashboard
            player={player}
            leaderboard={leaderboard}
            leaderboardLoading={leaderboardLoading}
            onNavigate={navigateTo}
            messages={messages}
            onMarkRead={markMessageRead}
          />
        )}

        {/* PICKS */}
        {view === "picks" && player && !player.is_admin && (
          <Picks
            player={player}
            actualMatches={actualMatches}
            actualGroupTopThree={actualGroupTopThree}
            actualR32={actualR32}
            actualR16={actualR16}
            actualQF={actualQF}
            actualSFRank={actualSFRank}
            koFixtures={koFixtures}
            koActualScores={koActualScores}
          />
        )}

        {/* LEADERBOARD */}
        {view === "leaderboard" && (
          <Leaderboard
            leaderboard={leaderboard}
            history={leaderboardHistory}
            loading={leaderboardLoading}
            onRefresh={loadLeaderboard}
          />
        )}

        {/* PROFILE */}
        {view === "profile" && player && !player.is_admin && (
          <Profile player={player} />
        )}

        {/* ALL PREDICTIONS */}
        {view === "predictions" && allPicksRevealed && (
          <AllPredictions
            player={player?.is_admin ? null : player?.name}
            actualMatches={actualMatches}
            actualGroupTopThree={actualGroupTopThree}
            actualR32={actualR32}
            actualR16={actualR16}
            actualQF={actualQF}
            actualSFRank={actualSFRank}
            koFixtures={koFixtures}
            koActualScores={koActualScores}
          />
        )}

        {/* ADMIN */}
        {view === "admin" && player?.is_admin && (
          <>
            <div className="section-title" style={{ marginBottom: 18 }}>🔧 Admin Panel</div>

            <div className="card">
              <div className="card-label">Tournament Deadlines</div>
              <table className="deadline-table">
                <thead>
                  <tr><th>Stage</th><th>Deadline</th><th>Status</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Global (all qualifying picks + group scores)</td>
                    <td className={isPast(GLOBAL_DEADLINE) ? "past" : "open"}>10 Jun 2026 23:59 (Portugal)</td>
                    <td className={isPast(GLOBAL_DEADLINE) ? "past" : "open"}>
                      {isPast(GLOBAL_DEADLINE) ? "🔒 Locked" : "🟢 Open"}
                    </td>
                  </tr>
                  {KO_ROUNDS.map(r => (
                    <tr key={r.id}>
                      <td>{r.label} scores</td>
                      <td className={isPast(r.deadline) ? "past" : openRound === r.id ? "open" : ""}>
                        {formatDeadline(r.deadline, r.tzLabel)}
                      </td>
                      <td className={isPast(r.deadline) ? "past" : openRound === r.id ? "open" : ""}>
                        {isPast(r.deadline) ? "🔒 Locked" : openRound === r.id ? "🟢 Open" : "⏳ Upcoming"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tab-row">
              {[
                ["fixtures", "🔧 KO Fixtures"],
                ["results", "⚽ Group Results"],
                ["groups", "📊 Group Top 3"],
                ["ko_results", "🏆 KO Results"],
                ["qualifiers", "👥 Qualifiers"],
                ["nudge", "📬 Nudge Players"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  className={`tab ${adminTab === k ? "active" : ""}`}
                  onClick={() => {
                    setAdminTab(k);
                    if (k === "nudge" && !nudgeData) loadNudgeData();
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* KO FIXTURES */}
            {adminTab === "fixtures" && (
              <div className="card">
                <div className="card-label">Enter knockout fixtures — players can then predict scores for each open round</div>
                {KO_ROUNDS.map(r => (
                  <div key={r.id} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#f0c030", marginBottom: 8, fontWeight: 700 }}>
                      {r.label}
                    </div>
                    {Array(r.games).fill(0).map((_, i) => {
                      const fix = (koFixtures[r.id] || [])[i] || {};
                      const availableTeams =
                        r.id === "R32" ? ALL_TEAMS :
                        r.id === "R16" ? (actualR32.filter(Boolean).length ? actualR32.filter(Boolean) : ALL_TEAMS) :
                        r.id === "QF"  ? (actualR16.filter(Boolean).length ? actualR16.filter(Boolean) : ALL_TEAMS) :
                        r.id === "SF"  ? (actualQF.filter(Boolean).length  ? actualQF.filter(Boolean)  : ALL_TEAMS) :
                        (actualSFRank.filter(Boolean).length ? actualSFRank.filter(Boolean) : ALL_TEAMS);
                      return (
                        <div key={i} className="fixture-row">
                          <div className="fixture-num">{i + 1}</div>
                          <select
                            className="fixture-sel"
                            value={fix.home || ""}
                            onChange={e => {
                              const u = { ...koFixtures };
                              if (!u[r.id]) u[r.id] = [];
                              if (!u[r.id][i]) u[r.id][i] = {};
                              u[r.id][i] = { ...u[r.id][i], home: e.target.value };
                              setKoFixtures(u);
                            }}
                          >
                            <option value="">— home —</option>
                            {[...availableTeams].sort((a, b) => a.localeCompare(b)).map(t => (
                              <option key={t} value={t}>{f(t)} {t}</option>
                            ))}
                          </select>
                          <div className="sep" style={{ textAlign: "center" }}>vs</div>
                          <select
                            className="fixture-sel"
                            value={fix.away || ""}
                            onChange={e => {
                              const u = { ...koFixtures };
                              if (!u[r.id]) u[r.id] = [];
                              if (!u[r.id][i]) u[r.id][i] = {};
                              u[r.id][i] = { ...u[r.id][i], away: e.target.value };
                              setKoFixtures(u);
                            }}
                          >
                            <option value="">— away —</option>
                            {[...availableTeams].sort((a, b) => a.localeCompare(b)).map(t => (
                              <option key={t} value={t}>{f(t)} {t}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* GROUP RESULTS */}
            {adminTab === "results" && Object.entries(GROUPS).map(([grp]) => (
              <div key={grp} className="card">
                <div className="card-label">Group {grp}</div>
                <div className="match-list">
                  {GROUP_MATCHES.filter(m => m.group === grp).map(m => {
                    const a = actualMatches[m.id] || {};
                    return (
                      <div key={m.id} className="match-row">
                        <div className="team-l">{f(m.home)} {m.home}</div>
                        <input
                          className="score-inp" type="number" min="0" max="20"
                          value={a.home_score ?? ""} placeholder="0"
                          onChange={e => setActualMatches(prev => ({ ...prev, [m.id]: { ...prev[m.id], home_score: e.target.value } }))}
                        />
                        <div className="sep">–</div>
                        <input
                          className="score-inp" type="number" min="0" max="20"
                          value={a.away_score ?? ""} placeholder="0"
                          onChange={e => setActualMatches(prev => ({ ...prev, [m.id]: { ...prev[m.id], away_score: e.target.value } }))}
                        />
                        <div className="team-r">{m.away} {f(m.away)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* GROUP TOP 3 */}
            {adminTab === "groups" && (
              <div className="card">
                <div className="card-label">Actual 1st, 2nd and 3rd per group</div>
                <div className="group-grid">
                  {Object.entries(GROUPS).map(([grp, teams]) => {
                    const v = actualGroupTopThree[grp] || { first: "", second: "", third: "" };
                    return (
                      <div key={grp} className="group-box">
                        <div className="group-box-title">Group {grp}</div>
                        {["first", "second", "third"].map((rank, i) => (
                          <div key={rank} className="rank-row">
                            <div className="rank-num">{i + 1}</div>
                            <select
                              className="rank-sel"
                              value={v[rank] || ""}
                              onChange={e => setActualGroupTopThree(prev => ({ ...prev, [grp]: { ...prev[grp], [rank]: e.target.value } }))}
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

            {/* KO ACTUAL SCORES */}
            {adminTab === "ko_results" && KO_ROUNDS.map(r => (
              <div key={r.id} className="card">
                <div className="card-label">{r.label} — actual scores</div>
                <KoMatchGrid
                  round={r.id}
                  fixtures={koFixtures[r.id]}
                  scores={koActualScores[r.id]}
                  setScores={s => setKoActualScores(prev => ({ ...prev, [r.id]: s }))}
                  disabled={false}
                />
              </div>
            ))}

            {/* QUALIFIERS */}
            {adminTab === "qualifiers" && (
              <>
                {[
                  { id: "R32", label: "R32 Qualifiers (32 teams)", arr: actualR32, setArr: setActualR32, size: 32 },
                  { id: "R16", label: "R16 Qualifiers (16 teams)", arr: actualR16, setArr: setActualR16, size: 16 },
                  { id: "QF",  label: "Quarter-Finalists (8 teams)", arr: actualQF, setArr: setActualQF, size: 8 },
                ].map(({ id, label, arr, setArr, size }) => (
                  <div key={id} className="card">
                    <div className="card-label">{label}</div>
                    <div className="ko-grid">
                      {Array(size).fill(0).map((_, i) => (
                        <select
                          key={i} className="rank-sel"
                          value={arr[i] || ""}
                          onChange={e => { const u = [...arr]; u[i] = e.target.value; setArr(u); }}
                        >
                          <option value="">— team {i + 1} —</option>
                          {SORTED_TEAMS.map(t => <option key={t} value={t}>{f(t)} {t}</option>)}
                        </select>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="card">
                  <div className="card-label">Final standings (1st–4th)</div>
                  <div className="sf-list">
                    {FINAL_RANKS.map((label, i) => (
                      <div key={i} className="sf-row">
                        <div className="sf-rank-label">{label}</div>
                        <select
                          className="rank-sel" style={{ maxWidth: 220 }}
                          value={actualSFRank[i] || ""}
                          onChange={e => { const u = [...actualSFRank]; u[i] = e.target.value; setActualSFRank(u); }}
                        >
                          <option value="">— team —</option>
                          {SORTED_TEAMS.map(t => <option key={t} value={t}>{f(t)} {t}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* NUDGE PLAYERS */}
            {adminTab === "nudge" && (
              <div className="card">
                <div className="card-label">Prediction completion status — send reminder messages to players with gaps</div>
                <div style={{ marginBottom: 12 }}>
                  <button className="tab" onClick={loadNudgeData} disabled={nudgeLoading}>
                    {nudgeLoading ? "Loading…" : "🔄 Refresh"}
                  </button>
                </div>
                {nudgeLoading ? (
                  <div className="spinner">Loading completion data…</div>
                ) : nudgeData ? (
                  <table className="deadline-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Group Scores</th>
                        <th>Group Rankings</th>
                        <th>R32</th>
                        <th>R16</th>
                        <th>QF</th>
                        <th>SF/Final</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nudgeData.map(p => {
                        const allDone = p.groupScores.done >= p.groupScores.total
                          && p.groupRankings.done >= p.groupRankings.total
                          && p.r32.done >= p.r32.total
                          && p.r16.done >= p.r16.total
                          && p.qf.done >= p.qf.total
                          && p.sf.done >= p.sf.total;
                        const cell = ({ done, total }) => (
                          <td className={done >= total ? "open" : done > 0 ? "" : "past"}>
                            {done}/{total}
                          </td>
                        );
                        return (
                          <tr key={p.name}>
                            <td style={{ fontWeight: 700 }}>{p.name}</td>
                            <td className={p.groupScores.done >= p.groupScores.total ? "open" : p.groupScores.done > 0 ? "" : "past"}>
                              {p.groupScores.done}/{p.groupScores.total}
                            </td>
                            <td className={p.groupRankings.done >= p.groupRankings.total ? "open" : p.groupRankings.done > 0 ? "" : "past"}>
                              {p.groupRankings.done}/{p.groupRankings.total}
                            </td>
                            {cell(p.r32)}
                            {cell(p.r16)}
                            {cell(p.qf)}
                            {cell(p.sf)}
                            <td>
                              {allDone ? (
                                <span style={{ color: "#4caf80", fontSize: 12 }}>All done ✓</span>
                              ) : nudgeSent[p.name] ? (
                                <span style={{ color: "#f0c030", fontSize: 12 }}>Sent ✓</span>
                              ) : (
                                <button
                                  className="tab"
                                  style={{ fontSize: 11, padding: "3px 10px" }}
                                  onClick={() => sendNudge(p)}
                                >
                                  📬 Nudge
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ color: "var(--text-dark)" }}>Click Refresh to load status.</div>
                )}
              </div>
            )}

            <div className="save-row">
              <button
                className={`btn-save ${saveState === "saved" ? "saved" : ""}`}
                disabled={saveState === "saving"}
                onClick={saveActuals}
              >
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved!" : "Save Results"}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
