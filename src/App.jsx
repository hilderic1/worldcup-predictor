import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = "wc_session";

// ─── 2026 WORLD CUP GROUPS ────────────────────────────────────────────────────
const GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czechia"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Türkiye"],
  E: ["Germany", "Curacao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "Congo DR", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

const ALL_TEAMS = Object.values(GROUPS).flat();

const GROUP_MATCHES = [
  { id: "A1", group: "A", home: "Mexico", away: "South Africa", date: "6/11/26", time: "20:00" },
  { id: "A2", group: "A", home: "South Korea", away: "Czechia", date: "6/12/26", time: "3:00" },
  { id: "A3", group: "A", home: "South Africa", away: "Czechia", date: "6/18/26", time: "17:00" },
  { id: "A4", group: "A", home: "Mexico", away: "South Korea", date: "6/19/26", time: "2:00" },
  { id: "A5", group: "A", home: "Mexico", away: "Czechia", date: "6/25/26", time: "2:00" },
  { id: "A6", group: "A", home: "South Africa", away: "South Korea", date: "6/25/26", time: "2:00" },
  { id: "B1", group: "B", home: "Canada", away: "Bosnia and Herzegovina", date: "6/12/26", time: "20:00" },
  { id: "B2", group: "B", home: "Qatar", away: "Switzerland", date: "6/13/26", time: "20:00" },
  { id: "B3", group: "B", home: "Bosnia and Herzegovina", away: "Switzerland", date: "6/18/26", time: "20:00" },
  { id: "B4", group: "B", home: "Canada", away: "Qatar", date: "6/18/26", time: "23:00" },
  { id: "B5", group: "B", home: "Canada", away: "Switzerland", date: "6/24/26", time: "20:00" },
  { id: "B6", group: "B", home: "Bosnia and Herzegovina", away: "Qatar", date: "6/24/26", time: "20:00" },
  { id: "C1", group: "C", home: "Brazil", away: "Morocco", date: "6/13/26", time: "23:00" },
  { id: "C2", group: "C", home: "Haiti", away: "Scotland", date: "6/14/26", time: "2:00" },
  { id: "C3", group: "C", home: "Brazil", away: "Haiti", date: "6/20/26", time: "2:00" },
  { id: "C4", group: "C", home: "Morocco", away: "Scotland", date: "6/19/26", time: "23:00" },
  { id: "C5", group: "C", home: "Brazil", away: "Scotland", date: "6/24/26", time: "23:00" },
  { id: "C6", group: "C", home: "Morocco", away: "Haiti", date: "6/24/26", time: "23:00" },
  { id: "D1", group: "D", home: "United States", away: "Paraguay", date: "6/13/26", time: "2:00" },
  { id: "D2", group: "D", home: "Australia", away: "Türkiye", date: "6/14/26", time: "5:00" },
  { id: "D3", group: "D", home: "Paraguay", away: "Türkiye", date: "6/20/26", time: "5:00" },
  { id: "D4", group: "D", home: "United States", away: "Australia", date: "6/19/26", time: "20:00" },
  { id: "D5", group: "D", home: "United States", away: "Türkiye", date: "6/26/26", time: "3:00" },
  { id: "D6", group: "D", home: "Paraguay", away: "Australia", date: "6/26/26", time: "3:00" },
  { id: "E1", group: "E", home: "Germany", away: "Curacao", date: "6/14/26", time: "18:00" },
  { id: "E2", group: "E", home: "Ivory Coast", away: "Ecuador", date: "6/15/26", time: "0:00" },
  { id: "E3", group: "E", home: "Germany", away: "Ivory Coast", date: "6/20/26", time: "21:00" },
  { id: "E4", group: "E", home: "Curacao", away: "Ecuador", date: "6/21/26", time: "1:00" },
  { id: "E5", group: "E", home: "Germany", away: "Ecuador", date: "6/25/26", time: "21:00" },
  { id: "E6", group: "E", home: "Curacao", away: "Ivory Coast", date: "6/25/26", time: "21:00" },
  { id: "F1", group: "F", home: "Netherlands", away: "Japan", date: "6/14/26", time: "21:00" },
  { id: "F2", group: "F", home: "Sweden", away: "Tunisia", date: "6/15/26", time: "3:00" },
  { id: "F3", group: "F", home: "Netherlands", away: "Sweden", date: "6/20/26", time: "18:00" },
  { id: "F4", group: "F", home: "Japan", away: "Tunisia", date: "6/21/26", time: "5:00" },
  { id: "F5", group: "F", home: "Netherlands", away: "Tunisia", date: "6/26/26", time: "0:00" },
  { id: "F6", group: "F", home: "Japan", away: "Sweden", date: "6/26/26", time: "0:00" },
  { id: "G1", group: "G", home: "Belgium", away: "Egypt", date: "6/15/26", time: "20:00" },
  { id: "G2", group: "G", home: "Iran", away: "New Zealand", date: "6/16/26", time: "2:00" },
  { id: "G3", group: "G", home: "Belgium", away: "Iran", date: "6/21/26", time: "20:00" },
  { id: "G4", group: "G", home: "Egypt", away: "New Zealand", date: "6/22/26", time: "2:00" },
  { id: "G5", group: "G", home: "Belgium", away: "New Zealand", date: "6/27/26", time: "4:00" },
  { id: "G6", group: "G", home: "Egypt", away: "Iran", date: "6/27/26", time: "4:00" },
  { id: "H1", group: "H", home: "Spain", away: "Cape Verde", date: "6/15/26", time: "17:00" },
  { id: "H2", group: "H", home: "Saudi Arabia", away: "Uruguay", date: "6/15/26", time: "23:00" },
  { id: "H3", group: "H", home: "Spain", away: "Saudi Arabia", date: "6/21/26", time: "17:00" },
  { id: "H4", group: "H", home: "Cape Verde", away: "Uruguay", date: "6/21/26", time: "23:00" },
  { id: "H5", group: "H", home: "Spain", away: "Uruguay", date: "6/27/26", time: "1:00" },
  { id: "H6", group: "H", home: "Cape Verde", away: "Saudi Arabia", date: "6/27/26", time: "1:00" },
  { id: "I1", group: "I", home: "France", away: "Senegal", date: "6/16/26", time: "20:00" },
  { id: "I2", group: "I", home: "Iraq", away: "Norway", date: "6/16/26", time: "23:00" },
  { id: "I3", group: "I", home: "France", away: "Iraq", date: "6/22/26", time: "22:00" },
  { id: "I4", group: "I", home: "Senegal", away: "Norway", date: "6/23/26", time: "1:00" },
  { id: "I5", group: "I", home: "France", away: "Norway", date: "6/26/26", time: "20:00" },
  { id: "I6", group: "I", home: "Senegal", away: "Iraq", date: "6/26/26", time: "20:00" },
  { id: "J1", group: "J", home: "Argentina", away: "Algeria", date: "6/17/26", time: "2:00" },
  { id: "J2", group: "J", home: "Austria", away: "Jordan", date: "6/17/26", time: "5:00" },
  { id: "J3", group: "J", home: "Argentina", away: "Austria", date: "6/22/26", time: "18:00" },
  { id: "J4", group: "J", home: "Algeria", away: "Jordan", date: "6/23/26", time: "4:00" },
  { id: "J5", group: "J", home: "Argentina", away: "Jordan", date: "6/28/26", time: "3:00" },
  { id: "J6", group: "J", home: "Algeria", away: "Austria", date: "6/28/26", time: "3:00" },
  { id: "K1", group: "K", home: "Portugal", away: "Congo DR", date: "6/17/26", time: "18:00" },
  { id: "K2", group: "K", home: "Uzbekistan", away: "Colombia", date: "6/18/26", time: "3:00" },
  { id: "K3", group: "K", home: "Portugal", away: "Uzbekistan", date: "6/23/26", time: "18:00" },
  { id: "K4", group: "K", home: "Congo DR", away: "Colombia", date: "6/24/26", time: "3:00" },
  { id: "K5", group: "K", home: "Portugal", away: "Colombia", date: "6/27/26", time: "18:30" },
  { id: "K6", group: "K", home: "Congo DR", away: "Uzbekistan", date: "6/27/26", time: "18:30" },
  { id: "L1", group: "L", home: "England", away: "Croatia", date: "6/17/26", time: "21:00" },
  { id: "L2", group: "L", home: "Ghana", away: "Panama", date: "6/18/26", time: "0:00" },
  { id: "L3", group: "L", home: "England", away: "Ghana", date: "6/23/26", time: "21:00" },
  { id: "L4", group: "L", home: "Croatia", away: "Panama", date: "6/24/26", time: "0:00" },
  { id: "L5", group: "L", home: "England", away: "Panama", date: "6/27/26", time: "22:00" },
  { id: "L6", group: "L", home: "Croatia", away: "Ghana", date: "6/27/26", time: "22:00" },
];

const PLAYERS = ["David","Dorian","Antonia","Irma","Laura","Dorus","Sandra","Hilde","Eric","Claude"];

const FINAL_RANKS = ["1st (Winner)", "2nd (Runner-up)", "3rd place", "4th place"];

// Knockout rounds config: id, label, games, deadline (ISO), timezone label
const KO_ROUNDS = [
  { id: "R32", label: "Round of 32", games: 16, deadline: "2026-06-28T07:00:00-07:00", tzLabel: "Los Angeles time" },
  { id: "R16", label: "Round of 16", games: 8,  deadline: "2026-07-04T07:00:00-05:00", tzLabel: "Houston time" },
  { id: "QF",  label: "Quarter-Finals", games: 4, deadline: "2026-07-08T23:59:00-04:00", tzLabel: "EDT" },
  { id: "SF",  label: "Semi-Finals", games: 2,  deadline: "2026-07-13T23:59:00-04:00", tzLabel: "EDT" },
  { id: "FINAL", label: "Bronze & Final", games: 2, deadline: "2026-07-17T23:59:00-04:00", tzLabel: "EDT" },
];

// Global deadline: June 10 2026 23:59 Portugal (WEST = UTC+1)
const GLOBAL_DEADLINE = "2026-06-10T23:59:00+01:00";

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────
function scoreMatch(pred, actual) {
  if (!pred || !actual || pred.home_score == null || actual.home_score == null) return { total: 0, result: 0, accuracy: 0, exact: 0 };
  const ph = +pred.home_score, pa = +pred.away_score;
  const ah = +actual.home_score, aa = +actual.away_score;
  if (isNaN(ph)||isNaN(pa)||isNaN(ah)||isNaN(aa)) return { total: 0, result: 0, accuracy: 0, exact: 0 };
  const pRes = ph > pa ? "H" : ph < pa ? "A" : "D";
  const aRes = ah > aa ? "H" : ah < aa ? "A" : "D";
  const result = pRes === aRes ? 10 : 0;
  const accuracy = Math.max(0, 10 - Math.abs(ph - ah)) + Math.max(0, 10 - Math.abs(pa - aa));
  const exact = (ph === ah && pa === aa) ? 10 : 0;
  return { total: result + accuracy + exact, result, accuracy, exact };
}

function scoreGroupTopThree(pred, actual) {
  if (!pred || !actual) return 0;
  let pts = 0;
  ["first","second","third"].forEach(rank => {
    const predTeam = pred[rank];
    if (!predTeam) return;
    const actualTeams = [actual.first, actual.second, actual.third];
    if (actualTeams.includes(predTeam)) {
      pts += 5;
      if (actual[rank] === predTeam) pts += 5;
    }
  });
  return pts;
}

function scoreKOQualifiers(predTeams, actualTeams, pts) {
  if (!predTeams || !actualTeams) return 0;
  return predTeams.filter(t => t && actualTeams.includes(t)).length * pts;
}

function scoreSFRanking(pred, actual) {
  if (!pred || !actual) return 0;
  let pts = 0;
  const actualSet = actual.filter(Boolean);
  pred.forEach((team, idx) => {
    if (!team) return;
    if (actualSet.includes(team)) {
      pts += 25;
      if (actual[idx] === team) pts += 5;
    }
  });
  return pts;
}

function calcTotalScore(preds, actuals) {
  let matchPts = 0, groupPts = 0, r32Pts = 0, r16Pts = 0, qfPts = 0, sfPts = 0;
  let koMatchPts = 0;

  // Group match scores
  GROUP_MATCHES.forEach(m => {
    matchPts += scoreMatch(preds.matches?.[m.id], actuals.matches?.[m.id]).total;
  });

  // Knockout match scores
  KO_ROUNDS.forEach(r => {
    (preds.koMatches?.[r.id] || []).forEach((pred, i) => {
      koMatchPts += scoreMatch(pred, actuals.koMatches?.[r.id]?.[i]).total;
    });
  });

  // Group top-3
  Object.keys(GROUPS).forEach(g => {
    groupPts += scoreGroupTopThree(preds.groupTopThree?.[g], actuals.groupTopThree?.[g]);
  });

  r32Pts  = scoreKOQualifiers(preds.r32,  actuals.r32,  10);
  r16Pts  = scoreKOQualifiers(preds.r16,  actuals.r16,  15);
  qfPts   = scoreKOQualifiers(preds.qf,   actuals.qf,   20);
  sfPts   = scoreSFRanking(preds.sfRanking, actuals.sfRanking);

  const total = matchPts + koMatchPts + groupPts + r32Pts + r16Pts + qfPts + sfPts;
  return { total, matchPts, koMatchPts, groupPts, r32Pts, r16Pts, qfPts, sfPts };
}

// ─── DEADLINE HELPERS ─────────────────────────────────────────────────────────
function isPast(isoString) {
  if (!isoString) return false;
  return new Date() > new Date(isoString);
}

// Returns which round is currently open for match score predictions
// null = group stage open, "R32"/"R16"/etc = that KO round open, "closed" = nothing open
function currentOpenRound() {
  if (!isPast(GLOBAL_DEADLINE)) return "GROUP";
  for (const r of KO_ROUNDS) {
    if (!isPast(r.deadline)) return r.id;
  }
  return "CLOSED";
}

function formatDeadline(isoString, tzLabel) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + ` (${tzLabel})`;
}

// ─── FLAGS ────────────────────────────────────────────────────────────────────
const FLAGS = {
  Mexico:"🇲🇽","South Africa":"🇿🇦","South Korea":"🇰🇷",Czechia:"🇨🇿",
  Canada:"🇨🇦","Bosnia and Herzegovina":"🇧🇦",Qatar:"🇶🇦",Switzerland:"🇨🇭",
  Brazil:"🇧🇷",Morocco:"🇲🇦",Haiti:"🇭🇹",Scotland:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "United States":"🇺🇸",Paraguay:"🇵🇾",Australia:"🇦🇺","Türkiye":"🇹🇷",
  Germany:"🇩🇪",Curacao:"🇨🇼","Ivory Coast":"🇨🇮",Ecuador:"🇪🇨",
  Netherlands:"🇳🇱",Japan:"🇯🇵",Sweden:"🇸🇪",Tunisia:"🇹🇳",
  Belgium:"🇧🇪",Egypt:"🇪🇬",Iran:"🇮🇷","New Zealand":"🇳🇿",
  Spain:"🇪🇸","Cape Verde":"🇨🇻","Saudi Arabia":"🇸🇦",Uruguay:"🇺🇾",
  France:"🇫🇷",Senegal:"🇸🇳",Iraq:"🇮🇶",Norway:"🇳🇴",
  Argentina:"🇦🇷",Algeria:"🇩🇿",Austria:"🇦🇹",Jordan:"🇯🇴",
  Portugal:"🇵🇹","Congo DR":"🇨🇩",Uzbekistan:"🇺🇿",Colombia:"🇨🇴",
  England:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",Croatia:"🇭🇷",Ghana:"🇬🇭",Panama:"🇵🇦",
};
const f = t => FLAGS[t] || "🏳️";

// ─── CSS ──────────────────────────────────────────────────────────────────────
// CSS has been moved to App.css

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [player, setPlayer] = useState(null);
  const [view, setView] = useState("login");
  const [predictTab, setPredictTab] = useState("matches");
  const [adminTab, setAdminTab] = useState("fixtures");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [loginError, setLoginError] = useState("");
  const [restoringSession, setRestoringSession] = useState(() => !!localStorage.getItem(SESSION_KEY));

  // Player predictions
  const [matchPreds, setMatchPreds] = useState({});
  const [groupTopThree, setGroupTopThree] = useState({});
  const [r32Pred, setR32Pred] = useState(Array(32).fill(""));
  const [r16Pred, setR16Pred] = useState(Array(16).fill(""));
  const [qfPred, setQfPred] = useState(Array(8).fill(""));
  const [sfRankPred, setSfRankPred] = useState(Array(4).fill(""));
  const [koMatchPreds, setKoMatchPreds] = useState({}); // roundId -> [{home_score, away_score}]

  // Actuals + fixtures (admin)
  const [actualMatches, setActualMatches] = useState({});
  const [actualGroupTopThree, setActualGroupTopThree] = useState({});
  const [actualR32, setActualR32] = useState(Array(32).fill(""));
  const [actualR16, setActualR16] = useState(Array(16).fill(""));
  const [actualQF, setActualQF] = useState(Array(8).fill(""));
  const [actualSFRank, setActualSFRank] = useState(Array(4).fill(""));
  const [koFixtures, setKoFixtures] = useState({}); // roundId -> [{home, away}]
  const [koActualScores, setKoActualScores] = useState({}); // roundId -> [{home_score, away_score}]

  const [leaderboard, setLeaderboard] = useState([]);

  const openRound = currentOpenRound();
  const globalLocked = isPast(GLOBAL_DEADLINE);

  // ── LOAD ACTUALS + FIXTURES ──
  const loadActuals = useCallback(async () => {
    const [rm, rg, rk, rf, rs] = await Promise.all([
      supabase.from("actual_results").select("*"),
      supabase.from("actual_group_rankings").select("*"),
      supabase.from("actual_knockout").select("*"),
      supabase.from("ko_fixtures").select("*"),
      supabase.from("ko_actual_scores").select("*"),
    ]);
    const am = {}; (rm.data||[]).forEach(r => am[r.match_id] = r);
    setActualMatches(am);
    const ag = {}; (rg.data||[]).forEach(r => {
      if (Array.isArray(r.ranking)) ag[r.group_id] = { first: r.ranking[0]||"", second: r.ranking[1]||"", third: r.ranking[2]||"" };
    });
    setActualGroupTopThree(ag);
    const ak = {}; (rk.data||[]).forEach(r => ak[r.round] = r.teams);
    setActualR32(ak["R32"] || Array(32).fill(""));
    setActualR16(ak["R16"] || Array(16).fill(""));
    setActualQF(ak["QF"]  || Array(8).fill(""));
    setActualSFRank(ak["SF_RANK"] || Array(4).fill(""));
    const fx = {}; (rf.data||[]).forEach(r => { if (!fx[r.round]) fx[r.round] = []; fx[r.round][r.game_index] = { home: r.home_team, away: r.away_team }; });
    setKoFixtures(fx);
    const ks = {}; (rs.data||[]).forEach(r => { if (!ks[r.round]) ks[r.round] = []; ks[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score }; });
    setKoActualScores(ks);
  }, []);

  useEffect(() => { loadActuals(); }, [loadActuals]);

  // ── LOAD PLAYER PREDICTIONS ──
  const loadPredictions = useCallback(async (name) => {
    setLoading(true);
    const [pm, pg, pk, pkm] = await Promise.all([
      supabase.from("match_predictions").select("*").eq("player_name", name),
      supabase.from("group_ranking_predictions").select("*").eq("player_name", name),
      supabase.from("knockout_predictions").select("*").eq("player_name", name),
      supabase.from("ko_match_predictions").select("*").eq("player_name", name),
    ]);
    const mp = {}; (pm.data||[]).forEach(r => mp[r.match_id] = r);
    setMatchPreds(mp);
    const gt = {}; (pg.data||[]).forEach(r => {
      if (Array.isArray(r.ranking)) gt[r.group_id] = { first: r.ranking[0]||"", second: r.ranking[1]||"", third: r.ranking[2]||"" };
    });
    setGroupTopThree(gt);
    const kp = {}; (pk.data||[]).forEach(r => kp[r.round] = r.teams);
    setR32Pred(kp["R32"] || Array(32).fill(""));
    setR16Pred(kp["R16"] || Array(16).fill(""));
    setQfPred(kp["QF"]  || Array(8).fill(""));
    setSfRankPred(kp["SF_RANK"] || Array(4).fill(""));
    const km = {}; (pkm.data||[]).forEach(r => { if (!km[r.round]) km[r.round] = []; km[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score }; });
    setKoMatchPreds(km);
    setLoading(false);
  }, []);

  // ── LEADERBOARD ──
  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    const [pm, pg, pk, pkm] = await Promise.all([
      supabase.from("match_predictions").select("*"),
      supabase.from("group_ranking_predictions").select("*"),
      supabase.from("knockout_predictions").select("*"),
      supabase.from("ko_match_predictions").select("*"),
    ]);
    const scores = PLAYERS.map(name => {
      const preds = { matches: {}, groupTopThree: {}, r32: null, r16: null, qf: null, sfRanking: null, koMatches: {} };
      (pm.data||[]).filter(r=>r.player_name===name).forEach(r => preds.matches[r.match_id] = r);
      (pg.data||[]).filter(r=>r.player_name===name).forEach(r => {
        if (Array.isArray(r.ranking)) preds.groupTopThree[r.group_id] = { first: r.ranking[0]||"", second: r.ranking[1]||"", third: r.ranking[2]||"" };
      });
      (pk.data||[]).filter(r=>r.player_name===name).forEach(r => {
        if (r.round==="R32") preds.r32 = r.teams;
        if (r.round==="R16") preds.r16 = r.teams;
        if (r.round==="QF") preds.qf = r.teams;
        if (r.round==="SF_RANK") preds.sfRanking = r.teams;
      });
      (pkm.data||[]).filter(r=>r.player_name===name).forEach(r => {
        if (!preds.koMatches[r.round]) preds.koMatches[r.round] = [];
        preds.koMatches[r.round][r.game_index] = { home_score: r.home_score, away_score: r.away_score };
      });
      const actuals = { matches: actualMatches, groupTopThree: actualGroupTopThree, r32: actualR32, r16: actualR16, qf: actualQF, sfRanking: actualSFRank, koMatches: koActualScores };
      return { name, ...calcTotalScore(preds, actuals) };
    });
    scores.sort((a,b) => b.total - a.total);
    setLeaderboard(scores);
    setLoading(false);
  }, [actualMatches, actualGroupTopThree, actualR32, actualR16, actualQF, actualSFRank, koActualScores]);

  // ── LOGIN ──
  const signIn = useCallback(async (name, password) => {
    const { data, error } = await supabase.from("players").select("*")
      .eq("name", name).eq("password_hash", password).single();
    if (error || !data) return false;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ name, password }));
    setPlayer(data);
    if (data.is_admin) setView("admin");
    else { await loadPredictions(data.name); setView("predict"); }
    return true;
  }, [loadPredictions]);

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

  // ── SAVE PREDICTIONS ──
  async function savePredictions() {
    setSaveState("saving");
    try {
      // Group match scores (only if group stage open)
      if (openRound === "GROUP") {
        const matchRows = Object.entries(matchPreds).map(([match_id, r]) => ({
          player_name: player.name, match_id, home_score: r.home_score, away_score: r.away_score
        }));
        if (matchRows.length) await supabase.from("match_predictions").upsert(matchRows, {onConflict:"player_name,match_id"});
      }

      // Qualifying predictions (only if global not locked)
      if (!globalLocked) {
        const groupRows = Object.entries(groupTopThree).map(([group_id, v]) => ({
          player_name: player.name, group_id, ranking: [v.first||"", v.second||"", v.third||""]
        }));
        if (groupRows.length) await supabase.from("group_ranking_predictions").upsert(groupRows, {onConflict:"player_name,group_id"});

        const koRows = [
          { player_name: player.name, round: "R32", teams: r32Pred },
          { player_name: player.name, round: "R16", teams: r16Pred },
          { player_name: player.name, round: "QF",  teams: qfPred },
          { player_name: player.name, round: "SF_RANK", teams: sfRankPred },
        ];
        await supabase.from("knockout_predictions").upsert(koRows, {onConflict:"player_name,round"});
      }

      // KO match scores (only for current open KO round)
      if (openRound !== "GROUP" && openRound !== "CLOSED") {
        const round = openRound;
        const preds = koMatchPreds[round] || [];
        const koMatchRows = preds.map((p, i) => ({
          player_name: player.name, round, game_index: i, home_score: p?.home_score, away_score: p?.away_score
        })).filter(r => r.home_score != null);
        if (koMatchRows.length) await supabase.from("ko_match_predictions").upsert(koMatchRows, {onConflict:"player_name,round,game_index"});
      }

      setSaveState("saved"); setTimeout(() => setSaveState("idle"), 3000);
    } catch { setSaveState("error"); setTimeout(() => setSaveState("idle"), 3000); }
  }

  // ── SAVE ACTUALS ──
  async function saveActuals() {
    setSaveState("saving");
    try {
      const matchRows = Object.entries(actualMatches).map(([match_id, r]) => ({
        match_id, home_score: r.home_score, away_score: r.away_score
      }));
      if (matchRows.length) await supabase.from("actual_results").upsert(matchRows, {onConflict:"match_id"});

      const groupRows = Object.entries(actualGroupTopThree).map(([group_id, v]) => ({
        group_id, ranking: [v.first||"", v.second||"", v.third||""]
      }));
      if (groupRows.length) await supabase.from("actual_group_rankings").upsert(groupRows, {onConflict:"group_id"});

      const koRows = [
        { round: "R32", teams: actualR32 },
        { round: "R16", teams: actualR16 },
        { round: "QF",  teams: actualQF },
        { round: "SF_RANK", teams: actualSFRank },
      ];
      await supabase.from("actual_knockout").upsert(koRows, {onConflict:"round"});

      // Save fixtures
      const fixtureRows = [];
      Object.entries(koFixtures).forEach(([round, games]) => {
        (games||[]).forEach((g, i) => {
          if (g?.home || g?.away) fixtureRows.push({ round, game_index: i, home_team: g.home||"", away_team: g.away||"" });
        });
      });
      if (fixtureRows.length) await supabase.from("ko_fixtures").upsert(fixtureRows, {onConflict:"round,game_index"});

      // Save KO actual scores
      const koScoreRows = [];
      Object.entries(koActualScores).forEach(([round, games]) => {
        (games||[]).forEach((g, i) => {
          if (g?.home_score != null) koScoreRows.push({ round, game_index: i, home_score: g.home_score, away_score: g.away_score });
        });
      });
      if (koScoreRows.length) await supabase.from("ko_actual_scores").upsert(koScoreRows, {onConflict:"round,game_index"});

      setSaveState("saved"); setTimeout(() => setSaveState("idle"), 3000);
    } catch { setSaveState("error"); setTimeout(() => setSaveState("idle"), 3000); }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setPlayer(null);
    setView("login");
  }

  // ── RENDER HELPERS ──
  function KoMatchGrid({ round, fixtures, scores, setScores, disabled }) {
    const games = KO_ROUNDS.find(r => r.id === round)?.games || 0;
    return (
      <div className="match-list">
        {Array(games).fill(0).map((_, i) => {
          const fix = fixtures?.[i];
          const sc = scores?.[i] || {};
          const home = fix?.home || `Team ${i*2+1}`;
          const away = fix?.away || `Team ${i*2+2}`;
          return (
            <div key={i} className="match-row">
              <div className="team-l">{f(home)} {home}</div>
              <input className="score-inp" type="number" min="0" max="20"
                value={sc.home_score ?? ""} placeholder="0" disabled={disabled || !fix?.home}
                onChange={e => { const u = [...(scores||[])]; if (!u[i]) u[i]={}; u[i]={...u[i],home_score:e.target.value}; setScores(u); }} />
              <div className="sep">–</div>
              <input className="score-inp" type="number" min="0" max="20"
                value={sc.away_score ?? ""} placeholder="0" disabled={disabled || !fix?.home}
                onChange={e => { const u = [...(scores||[])]; if (!u[i]) u[i]={}; u[i]={...u[i],away_score:e.target.value}; setScores(u); }} />
              <div className="team-r">{away} {f(away)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div>
        <header className="header">
          <div className="header-inner">
            <div className="logo">⚽ PREDICT<span>OR</span> <span style={{fontSize:12,color:'#1e2e4a',letterSpacing:1}}>WC2026</span></div>
            <div className="nav">
              {player && <span className="nav-user">👤 {player.name}</span>}
              {player && !player.is_admin && <button className={`nav-pill ${view==="predict"?"active":""}`} onClick={()=>setView("predict")}>My Picks</button>}
              {player?.is_admin && <button className={`nav-pill ${view==="admin"?"active":""}`} onClick={()=>setView("admin")}>Admin</button>}
              {player && <button className={`nav-pill ${view==="leaderboard"?"active":""}`} onClick={()=>{loadLeaderboard();setView("leaderboard");}}>Leaderboard</button>}
              {player && <button className="nav-pill" onClick={logout}>Exit</button>}
            </div>
          </div>
        </header>

        <div className="main">

          {/* LOGIN */}
          {view==="login" && !restoringSession && (
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
                      {[...PLAYERS,"Admin"].map(n => <option key={n} value={n}>{n}</option>)}
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

          {/* PREDICTIONS */}
          {view==="predict" && player && (
            <>
              <div className="section-header">
                <div className="section-title">⚽ {player.name}'s Picks</div>
              </div>

              {/* Status notice */}
              {openRound === "GROUP" && !globalLocked && (
                <div className="notice warn">🟢 Group stage open — predict all 72 match scores and all qualifying teams before <strong>10 June 2026</strong>.</div>
              )}
              {openRound !== "GROUP" && openRound !== "CLOSED" && (
                <div className="notice amber">⚽ {KO_ROUNDS.find(r=>r.id===openRound)?.label} match scores are now open. Deadline: {formatDeadline(KO_ROUNDS.find(r=>r.id===openRound)?.deadline, KO_ROUNDS.find(r=>r.id===openRound)?.tzLabel)}</div>
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
                {/* Group match scores: only during group stage */}
                <button className={`tab ${predictTab==="matches"?"active":""} ${openRound!=="GROUP"?"past":""}`}
                  onClick={()=>{ if(openRound==="GROUP") setPredictTab("matches"); }}>⚽ Group Scores</button>

                {/* Qualifying predictions: locked after global deadline */}
                {["groups","r32","r16","qf","sf"].map(k => (
                  <button key={k} className={`tab ${predictTab===k?"active":""} ${globalLocked?"past":""}`}
                    onClick={()=>{ if(!globalLocked) setPredictTab(k); }}>
                    {k==="groups"?"📊 Groups":k==="r32"?"R32":k==="r16"?"R16":k==="qf"?"QF":"🥇 Final"}
                  </button>
                ))}

                {/* KO round match scores: one per round, only when that round is open */}
                {KO_ROUNDS.map(r => {
                  const isOpen = openRound === r.id;
                  return (
                    <button key={`ko_${r.id}`} className={`tab ${predictTab===`ko_${r.id}`?"active":""} ${!isOpen?"past":""}`}
                      onClick={()=>{ if(isOpen) setPredictTab(`ko_${r.id}`); }}>
                      {r.id==="R32"?"R32 Scores":r.id==="R16"?"R16 Scores":r.id==="QF"?"QF Scores":r.id==="SF"?"SF Scores":"Final Scores"}
                    </button>
                  );
                })}
              </div>

              {loading ? <div className="spinner">Loading…</div> : <>

                {/* GROUP MATCH SCORES */}
                {predictTab==="matches" && (
                  openRound !== "GROUP"
                    ? <div className="notice info">🔒 Group stage predictions are locked.</div>
                    : Object.entries(GROUPS).map(([grp]) => (
                      <div key={grp} className="card">
                        <div className="card-label">Group {grp}</div>
                        <div className="match-list">
                          {GROUP_MATCHES.filter(m=>m.group===grp).map(m => {
                            const p = matchPreds[m.id]||{};
                            const a = actualMatches[m.id];
                            const sc = a ? scoreMatch(p, a) : null;
                            return (
                              <div key={m.id} className="match-row">
                                <div className="team-l">{f(m.home)} {m.home}</div>
                                <input className="score-inp" type="number" min="0" max="20"
                                  value={p.home_score??""} placeholder="0"
                                  onChange={e=>setMatchPreds(prev=>({...prev,[m.id]:{...prev[m.id],home_score:e.target.value}}))} />
                                <div className="sep">–</div>
                                <input className="score-inp" type="number" min="0" max="20"
                                  value={p.away_score??""} placeholder="0"
                                  onChange={e=>setMatchPreds(prev=>({...prev,[m.id]:{...prev[m.id],away_score:e.target.value}}))} />
                                <div className="team-r">{m.away} {f(m.away)}</div>
                                <div style={{gridColumn:"1/-1",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                  <span style={{fontSize:10,color:"#2a3a5a"}}>{m.date} {m.time} UTC</span>
                                  {sc!==null && <span className="match-pts">+{sc.total}pts (result {sc.result} · accuracy {sc.accuracy} · exact {sc.exact})</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                )}

                {/* GROUP TOP 3 */}
                {predictTab==="groups" && (
                  <div className="card">
                    <div className="card-label">Predict 1st, 2nd and 3rd per group — locked at global deadline</div>
                    <div className="group-grid">
                      {Object.entries(GROUPS).map(([grp, teams]) => {
                        const v = groupTopThree[grp]||{first:"",second:"",third:""};
                        return (
                          <div key={grp} className="group-box">
                            <div className="group-box-title">Group {grp}</div>
                            {["first","second","third"].map((rank,i) => (
                              <div key={rank} className="rank-row">
                                <div className="rank-num">{i+1}</div>
                                <select className="rank-sel" disabled={globalLocked}
                                  value={v[rank]||""}
                                  onChange={e=>setGroupTopThree(prev=>({...prev,[grp]:{...prev[grp],[rank]:e.target.value}}))}>
                                  <option value="">— pick —</option>
                                  {teams.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
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
                {predictTab==="r32" && (
                  <div className="card">
                    <div className="card-label">All 32 R32 qualifiers — 10pts per correct team — locked at global deadline</div>
                    <div className="ko-grid">
                      {Array(32).fill(0).map((_,i) => (
                        <select key={i} className="rank-sel" disabled={globalLocked}
                          value={r32Pred[i]||""}
                          onChange={e=>{const u=[...r32Pred];u[i]=e.target.value;setR32Pred(u);}}>
                          <option value="">— pick {i+1} —</option>
                          {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                        </select>
                      ))}
                    </div>
                  </div>
                )}

                {/* R16 QUALIFIERS */}
                {predictTab==="r16" && (
                  <div className="card">
                    <div className="card-label">16 R16 qualifiers — 15pts per correct team — locked at global deadline</div>
                    <div className="ko-grid">
                      {Array(16).fill(0).map((_,i) => (
                        <select key={i} className="rank-sel" disabled={globalLocked}
                          value={r16Pred[i]||""}
                          onChange={e=>{const u=[...r16Pred];u[i]=e.target.value;setR16Pred(u);}}>
                          <option value="">— pick {i+1} —</option>
                          {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                        </select>
                      ))}
                    </div>
                  </div>
                )}

                {/* QF QUALIFIERS */}
                {predictTab==="qf" && (
                  <div className="card">
                    <div className="card-label">8 Quarter-Finalists — 20pts per correct team — locked at global deadline</div>
                    <div className="ko-grid">
                      {Array(8).fill(0).map((_,i) => (
                        <select key={i} className="rank-sel" disabled={globalLocked}
                          value={qfPred[i]||""}
                          onChange={e=>{const u=[...qfPred];u[i]=e.target.value;setQfPred(u);}}>
                          <option value="">— pick {i+1} —</option>
                          {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                        </select>
                      ))}
                    </div>
                  </div>
                )}

                {/* FINAL RANKING */}
                {predictTab==="sf" && (
                  <div className="card">
                    <div className="card-label">Final standings 1st–4th — 25pts per team + 5pts correct rank — locked at global deadline</div>
                    <div className="sf-list">
                      {FINAL_RANKS.map((label,i) => (
                        <div key={i} className="sf-row">
                          <div className="sf-rank-label">{label}</div>
                          <select className="rank-sel" style={{maxWidth:220}} disabled={globalLocked}
                            value={sfRankPred[i]||""}
                            onChange={e=>{const u=[...sfRankPred];u[i]=e.target.value;setSfRankPred(u);}}>
                            <option value="">— pick team —</option>
                            {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* KO ROUND MATCH SCORES */}
                {KO_ROUNDS.map(r => predictTab===`ko_${r.id}` && (
                  <div key={r.id} className="card">
                    <div className="card-label">{r.label} — predict scores — deadline: {formatDeadline(r.deadline, r.tzLabel)}</div>
                    {!(koFixtures[r.id]||[]).some(fx=>fx?.home) && (
                      <div className="notice info">⏳ Admin hasn't entered the fixtures for this round yet.</div>
                    )}
                    <KoMatchGrid
                      round={r.id}
                      fixtures={koFixtures[r.id]}
                      scores={koMatchPreds[r.id]}
                      setScores={s => setKoMatchPreds(prev=>({...prev,[r.id]:s}))}
                      disabled={openRound !== r.id}
                    />
                  </div>
                ))}

                <div className="save-row">
                  <button className={`btn-save ${saveState==="saved"?"saved":""}`} disabled={saveState==="saving"} onClick={savePredictions}>
                    {saveState==="saving"?"Saving…":saveState==="saved"?"✓ Saved!":"Save Predictions"}
                  </button>
                  {saveState==="error" && <span style={{color:"#cc3333",fontSize:12}}>Save failed — check your connection</span>}
                </div>
              </>}
            </>
          )}

          {/* ADMIN */}
          {view==="admin" && player?.is_admin && (
            <>
              <div className="section-title" style={{marginBottom:18}}>🔧 Admin Panel</div>

              {/* Deadline overview */}
              <div className="card">
                <div className="card-label">Tournament Deadlines</div>
                <table className="deadline-table">
                  <thead><tr><th>Stage</th><th>Deadline</th><th>Status</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>Global (all qualifying picks + group scores)</td>
                      <td className={isPast(GLOBAL_DEADLINE)?"past":"open"}>10 Jun 2026 23:59 (Portugal)</td>
                      <td className={isPast(GLOBAL_DEADLINE)?"past":"open"}>{isPast(GLOBAL_DEADLINE)?"🔒 Locked":"🟢 Open"}</td>
                    </tr>
                    {KO_ROUNDS.map(r => (
                      <tr key={r.id}>
                        <td>{r.label} scores</td>
                        <td className={isPast(r.deadline)?"past":openRound===r.id?"open":""}>{formatDeadline(r.deadline, r.tzLabel)}</td>
                        <td className={isPast(r.deadline)?"past":openRound===r.id?"open":""}>{isPast(r.deadline)?"🔒 Locked":openRound===r.id?"🟢 Open":"⏳ Upcoming"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="tab-row">
                {[["fixtures","🔧 KO Fixtures"],["results","⚽ Group Results"],["groups","📊 Group Top 3"],["ko_results","🏆 KO Results"],["qualifiers","👥 Qualifiers"]].map(([k,l]) => (
                  <button key={k} className={`tab ${adminTab===k?"active":""}`} onClick={()=>setAdminTab(k)}>{l}</button>
                ))}
              </div>

              {/* KO FIXTURES */}
              {adminTab==="fixtures" && (
                <div className="card">
                  <div className="card-label">Enter knockout fixtures — players can then predict scores for each open round</div>
                  {KO_ROUNDS.map(r => (
                    <div key={r.id} style={{marginBottom:20}}>
                      <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#f0c030",marginBottom:8,fontWeight:700}}>{r.label}</div>
                      {Array(r.games).fill(0).map((_,i) => {
                        const fix = (koFixtures[r.id]||[])[i]||{};
                        const availableTeams = r.id==="R32" ? ALL_TEAMS :
                          r.id==="R16" ? (actualR32.filter(Boolean).length ? actualR32.filter(Boolean) : ALL_TEAMS) :
                          r.id==="QF"  ? (actualR16.filter(Boolean).length ? actualR16.filter(Boolean) : ALL_TEAMS) :
                          r.id==="SF"  ? (actualQF.filter(Boolean).length  ? actualQF.filter(Boolean)  : ALL_TEAMS) :
                          (actualSFRank.filter(Boolean).length ? actualSFRank.filter(Boolean) : ALL_TEAMS);
                        return (
                          <div key={i} className="fixture-row">
                            <div className="fixture-num">{i+1}</div>
                            <select className="fixture-sel"
                              value={fix.home||""}
                              onChange={e=>{const u={...koFixtures};if(!u[r.id])u[r.id]=[];if(!u[r.id][i])u[r.id][i]={};u[r.id][i]={...u[r.id][i],home:e.target.value};setKoFixtures(u);}}>
                              <option value="">— home —</option>
                              {availableTeams.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                            </select>
                            <div className="sep" style={{textAlign:"center"}}>vs</div>
                            <select className="fixture-sel"
                              value={fix.away||""}
                              onChange={e=>{const u={...koFixtures};if(!u[r.id])u[r.id]=[];if(!u[r.id][i])u[r.id][i]={};u[r.id][i]={...u[r.id][i],away:e.target.value};setKoFixtures(u);}}>
                              <option value="">— away —</option>
                              {availableTeams.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* GROUP RESULTS */}
              {adminTab==="results" && Object.entries(GROUPS).map(([grp]) => (
                <div key={grp} className="card">
                  <div className="card-label">Group {grp}</div>
                  <div className="match-list">
                    {GROUP_MATCHES.filter(m=>m.group===grp).map(m => {
                      const a = actualMatches[m.id]||{};
                      return (
                        <div key={m.id} className="match-row">
                          <div className="team-l">{f(m.home)} {m.home}</div>
                          <input className="score-inp" type="number" min="0" max="20" value={a.home_score??""} placeholder="0"
                            onChange={e=>setActualMatches(prev=>({...prev,[m.id]:{...prev[m.id],home_score:e.target.value}}))} />
                          <div className="sep">–</div>
                          <input className="score-inp" type="number" min="0" max="20" value={a.away_score??""} placeholder="0"
                            onChange={e=>setActualMatches(prev=>({...prev,[m.id]:{...prev[m.id],away_score:e.target.value}}))} />
                          <div className="team-r">{m.away} {f(m.away)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* GROUP TOP 3 */}
              {adminTab==="groups" && (
                <div className="card">
                  <div className="card-label">Actual 1st, 2nd and 3rd per group</div>
                  <div className="group-grid">
                    {Object.entries(GROUPS).map(([grp, teams]) => {
                      const v = actualGroupTopThree[grp]||{first:"",second:"",third:""};
                      return (
                        <div key={grp} className="group-box">
                          <div className="group-box-title">Group {grp}</div>
                          {["first","second","third"].map((rank,i) => (
                            <div key={rank} className="rank-row">
                              <div className="rank-num">{i+1}</div>
                              <select className="rank-sel" value={v[rank]||""}
                                onChange={e=>setActualGroupTopThree(prev=>({...prev,[grp]:{...prev[grp],[rank]:e.target.value}}))}>
                                <option value="">— pick —</option>
                                {teams.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
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
              {adminTab==="ko_results" && KO_ROUNDS.map(r => (
                <div key={r.id} className="card">
                  <div className="card-label">{r.label} — actual scores</div>
                  <KoMatchGrid
                    round={r.id}
                    fixtures={koFixtures[r.id]}
                    scores={koActualScores[r.id]}
                    setScores={s=>setKoActualScores(prev=>({...prev,[r.id]:s}))}
                    disabled={false}
                  />
                </div>
              ))}

              {/* QUALIFIERS */}
              {adminTab==="qualifiers" && (
                <>
                  {[{id:"R32",label:"R32 Qualifiers (32 teams)",arr:actualR32,setArr:setActualR32,size:32},
                    {id:"R16",label:"R16 Qualifiers (16 teams)",arr:actualR16,setArr:setActualR16,size:16},
                    {id:"QF", label:"Quarter-Finalists (8 teams)",arr:actualQF,setArr:setActualQF,size:8}].map(({id,label,arr,setArr,size}) => (
                    <div key={id} className="card">
                      <div className="card-label">{label}</div>
                      <div className="ko-grid">
                        {Array(size).fill(0).map((_,i) => (
                          <select key={i} className="rank-sel" value={arr[i]||""}
                            onChange={e=>{const u=[...arr];u[i]=e.target.value;setArr(u);}}>
                            <option value="">— team {i+1} —</option>
                            {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                          </select>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="card">
                    <div className="card-label">Final standings (1st–4th)</div>
                    <div className="sf-list">
                      {FINAL_RANKS.map((label,i) => (
                        <div key={i} className="sf-row">
                          <div className="sf-rank-label">{label}</div>
                          <select className="rank-sel" style={{maxWidth:220}} value={actualSFRank[i]||""}
                            onChange={e=>{const u=[...actualSFRank];u[i]=e.target.value;setActualSFRank(u);}}>
                            <option value="">— team —</option>
                            {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="save-row">
                <button className={`btn-save ${saveState==="saved"?"saved":""}`} disabled={saveState==="saving"} onClick={saveActuals}>
                  {saveState==="saving"?"Saving…":saveState==="saved"?"✓ Saved!":"Save Results"}
                </button>
              </div>
            </>
          )}

          {/* LEADERBOARD */}
          {view==="leaderboard" && (
            <>
              <div className="section-header">
                <div className="section-title">🏆 Leaderboard</div>
              </div>
              {!globalLocked && <div className="notice info">👁 Qualifying predictions hidden until global deadline passes.</div>}
              {loading ? <div className="spinner">Calculating…</div> : (
                <div className="lb-list">
                  {leaderboard.map((e,idx) => (
                    <div key={e.name} className={`lb-row ${idx===0?"r1":idx===1?"r2":idx===2?"r3":""}`}>
                      <div className={`lb-pos p${idx<3?idx+1:"n"}`}>{idx+1}</div>
                      <div>
                        <div className="lb-name">{e.name}</div>
                        <div className="lb-breakdown">
                          Groups {e.matchPts+e.koMatchPts} · Top-3 {e.groupPts} · R32 {e.r32Pts} · R16 {e.r16Pts} · QF {e.qfPts} · SF/Final {e.sfPts}
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div className="lb-pts">{e.total}</div>
                        <div className="lb-lbl">pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
