import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 2026 WORLD CUP GROUPS ────────────────────────────────────────────────────
const GROUPS = {
  A: ["Mexico", "South Africa", "Ivory Coast", "South Korea"],
  B: ["Canada", "Belgium", "Ecuador", "Bosnia-Herzegovina"],
  C: ["Brazil", "Morocco", "Croatia", "Iran"],
  D: ["France", "Senegal", "Switzerland", "Uzbekistan"],
  E: ["Spain", "Czechia", "Saudi Arabia", "Cape Verde"],
  F: ["Germany", "Curaçao", "Egypt", "Jordan"],
  G: ["USA", "Paraguay", "Australia", "DR Congo"],
  H: ["Argentina", "Algeria", "Cameroon", "New Zealand"],
  I: ["Portugal", "Colombia", "Ghana", "Costa Rica"],
  J: ["Netherlands", "Japan", "Tunisia", "Uruguay"],
  K: ["Italy", "Qatar", "Slovenia", "Haiti"],
  L: ["England", "Norway", "Scotland", "Chile"],
};

const ALL_TEAMS = Object.values(GROUPS).flat();

const GROUP_MATCHES = Object.entries(GROUPS).flatMap(([grp, t]) => [
  { id: `${grp}1`, group: grp, home: t[0], away: t[1] },
  { id: `${grp}2`, group: grp, home: t[2], away: t[3] },
  { id: `${grp}3`, group: grp, home: t[0], away: t[2] },
  { id: `${grp}4`, group: grp, home: t[1], away: t[3] },
  { id: `${grp}5`, group: grp, home: t[0], away: t[3] },
  { id: `${grp}6`, group: grp, home: t[1], away: t[2] },
]);

const PLAYERS = ["David","Dorian","Antonia","Irma","Laura","Dorus","Sandra","Hilde","Eric","Claude"];

// Final ranking labels for semi-finals prediction
const FINAL_RANKS = ["1st (Winner)", "2nd (Runner-up)", "3rd place", "4th place"];

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────

// 4.1 + 4.2 + 4.3: match scoring (max 40pts)
function scoreMatch(pred, actual) {
  if (!pred || !actual || pred.home_score == null || actual.home_score == null) return { total: 0, result: 0, accuracy: 0, exact: 0 };
  const ph = +pred.home_score, pa = +pred.away_score;
  const ah = +actual.home_score, aa = +actual.away_score;
  if (isNaN(ph) || isNaN(pa) || isNaN(ah) || isNaN(aa)) return { total: 0, result: 0, accuracy: 0, exact: 0 };

  // 4.1 correct result
  const pRes = ph > pa ? "H" : ph < pa ? "A" : "D";
  const aRes = ah > aa ? "H" : ah < aa ? "A" : "D";
  const result = pRes === aRes ? 10 : 0;

  // 4.2 goal accuracy — per team, 10 minus absolute difference
  const homeAcc = Math.max(0, 10 - Math.abs(ph - ah));
  const awayAcc = Math.max(0, 10 - Math.abs(pa - aa));
  const accuracy = homeAcc + awayAcc;

  // 4.3 exact score bonus
  const exact = (ph === ah && pa === aa) ? 10 : 0;

  return { total: result + accuracy + exact, result, accuracy, exact };
}

// 4.5 group stage: top 2 per group
// pred: { first: team, second: team }  actual: { first: team, second: team }
function scoreGroupTopTwo(pred, actual) {
  if (!pred || !actual) return 0;
  let pts = 0;
  // 5pts for predicting a team advances (in either 1st or 2nd), +5pts for correct rank
  ["first", "second", "third"].forEach(rank => {
    const predTeam = pred[rank];
    if (!predTeam) return;
    const actualTeams = [actual.first, actual.second];
    if (actualTeams.includes(predTeam)) {
      pts += 5; // team advances
      if (actual[rank] === predTeam) pts += 5; // correct rank
    }
  });
  return pts;
}

// R32: 10pts per correctly predicted team among all 32 qualifiers
function scoreR32(predTeams, actualTeams) {
  if (!predTeams || !actualTeams) return 0;
  return predTeams.filter(t => t && actualTeams.includes(t)).length * 10;
}

// 4.6 QF: 20pts per correctly predicted team
function scoreQF(predTeams, actualTeams) {
  if (!predTeams || !actualTeams) return 0;
  return predTeams.filter(t => t && actualTeams.includes(t)).length * 20;
}

// 4.7 SF + final ranking: 25pts per team + 5pts for correct final rank (1/2/3/4)
// pred/actual: array of 4 teams in order [1st, 2nd, 3rd, 4th]
function scoreSFRanking(pred, actual) {
  if (!pred || !actual) return 0;
  let pts = 0;
  const actualSet = actual.filter(Boolean);
  pred.forEach((team, idx) => {
    if (!team) return;
    if (actualSet.includes(team)) {
      pts += 25; // team reaches SF
      if (actual[idx] === team) pts += 5; // correct final rank
    }
  });
  return pts;
}

function calcTotalScore(preds, actuals) {
  let matchPts = 0, groupPts = 0, r32Pts = 0, r16Pts = 0, qfPts = 0, sfPts = 0;

  GROUP_MATCHES.forEach(m => {
    matchPts += scoreMatch(preds.matches?.[m.id], actuals.matches?.[m.id]).total;
  });

  Object.keys(GROUPS).forEach(g => {
    groupPts += scoreGroupTopTwo(preds.groupTopTwo?.[g], actuals.groupTopTwo?.[g]);
  });

  r32Pts = scoreR32(preds.r32, actuals.r32);
  r16Pts = (preds.r16 && actuals.r16) ? preds.r16.filter(t => t && actuals.r16.includes(t)).length * 15 : 0;
  qfPts = scoreQF(preds.qf, actuals.qf);
  sfPts = scoreSFRanking(preds.sfRanking, actuals.sfRanking);

  return { total: matchPts + groupPts + r32Pts + r16Pts + qfPts + sfPts, matchPts, groupPts, r32Pts, r16Pts, qfPts, sfPts };
}

// ─── FLAGS ────────────────────────────────────────────────────────────────────
const FLAGS = {
  Mexico:"🇲🇽","South Africa":"🇿🇦","Ivory Coast":"🇨🇮","South Korea":"🇰🇷",
  Canada:"🇨🇦",Belgium:"🇧🇪",Ecuador:"🇪🇨","Bosnia-Herzegovina":"🇧🇦",
  Brazil:"🇧🇷",Morocco:"🇲🇦",Croatia:"🇭🇷",Iran:"🇮🇷",
  France:"🇫🇷",Senegal:"🇸🇳",Switzerland:"🇨🇭",Uzbekistan:"🇺🇿",
  Spain:"🇪🇸",Czechia:"🇨🇿","Saudi Arabia":"🇸🇦","Cape Verde":"🇨🇻",
  Germany:"🇩🇪","Curaçao":"🇨🇼",Egypt:"🇪🇬",Jordan:"🇯🇴",
  USA:"🇺🇸",Paraguay:"🇵🇾",Australia:"🇦🇺","DR Congo":"🇨🇩",
  Argentina:"🇦🇷",Algeria:"🇩🇿",Cameroon:"🇨🇲","New Zealand":"🇳🇿",
  Portugal:"🇵🇹",Colombia:"🇨🇴",Ghana:"🇬🇭","Costa Rica":"🇨🇷",
  Netherlands:"🇳🇱",Japan:"🇯🇵",Tunisia:"🇹🇳",Uruguay:"🇺🇾",
  Italy:"🇮🇹",Qatar:"🇶🇦",Slovenia:"🇸🇮",Haiti:"🇭🇹",
  England:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",Norway:"🇳🇴",Scotland:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",Chile:"🇨🇱",
};
const f = t => FLAGS[t] || "🏳️";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #070c18; color: #dde3f0; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
  ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #070c18; } ::-webkit-scrollbar-thumb { background: #1e2e4a; border-radius: 3px; }
  .app { min-height: 100vh; }

  .header { background: linear-gradient(90deg,#060b17,#0b1830,#060b17); border-bottom: 1px solid #14243d; padding: 0 16px; position: sticky; top: 0; z-index: 100; }
  .header-inner { max-width: 980px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 54px; gap: 10px; }
  .logo { font-family: 'Bebas Neue'; font-size: 22px; letter-spacing: 3px; color: #f0c030; white-space: nowrap; }
  .logo span { color: #fff; }
  .nav { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
  .nav-pill { background: transparent; border: 1px solid #1e2e4a; color: #5566aa; padding: 4px 11px; border-radius: 20px; cursor: pointer; font-size: 12px; font-family: 'DM Sans'; transition: all .15s; white-space: nowrap; }
  .nav-pill:hover { border-color: #f0c030; color: #f0c030; }
  .nav-pill.active { background: #f0c030; color: #070c18; border-color: #f0c030; font-weight: 600; }
  .nav-user { font-size: 12px; color: #445577; white-space: nowrap; }

  .main { max-width: 980px; margin: 0 auto; padding: 22px 14px 60px; }

  /* LOGIN */
  .login-outer { min-height: calc(100vh - 54px); display: flex; align-items: center; justify-content: center; padding: 20px 14px; }
  .login-box { background: #0b1220; border: 1px solid #14243d; border-radius: 16px; padding: 30px 26px; width: 100%; max-width: 400px; }
  .login-logo { font-family: 'Bebas Neue'; font-size: 32px; letter-spacing: 4px; color: #f0c030; margin-bottom: 4px; }
  .login-sub { color: #334466; font-size: 13px; margin-bottom: 24px; }
  .login-error { background: #180808; border: 1px solid #4a1515; border-radius: 8px; padding: 9px 13px; color: #dd4444; font-size: 13px; margin-bottom: 14px; }
  .field { margin-bottom: 13px; }
  .field label { display: block; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #334466; margin-bottom: 5px; font-weight: 600; }
  .field select, .field input { width: 100%; background: #070c18; border: 1px solid #1a2a40; color: #dde3f0; padding: 8px 11px; border-radius: 8px; font-size: 14px; font-family: 'DM Sans'; transition: border .15s; }
  .field select:focus, .field input:focus { outline: none; border-color: #f0c030; }
  .btn-primary { width: 100%; background: #f0c030; color: #070c18; border: none; padding: 10px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans'; transition: all .15s; }
  .btn-primary:hover { background: #ffd440; }

  /* LAYOUT */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 8px; }
  .section-title { font-family: 'Bebas Neue'; font-size: 20px; letter-spacing: 2px; color: #f0c030; display: flex; align-items: center; gap: 8px; }
  .badge-locked { background: #1a0808; border: 1px solid #4a1515; color: #cc3333; padding: 3px 9px; border-radius: 12px; font-size: 10px; font-weight: 600; }
  .badge-open { background: #081508; border: 1px solid #154a20; color: #33cc66; padding: 3px 9px; border-radius: 12px; font-size: 10px; font-weight: 600; }

  .tab-row { display: flex; gap: 5px; margin-bottom: 18px; flex-wrap: wrap; }
  .tab { padding: 6px 14px; border-radius: 20px; border: 1px solid #14243d; background: transparent; color: #334466; cursor: pointer; font-size: 12px; font-family: 'DM Sans'; transition: all .15s; white-space: nowrap; }
  .tab.active { background: #f0c030; color: #070c18; border-color: #f0c030; font-weight: 600; }
  .tab:hover:not(.active) { border-color: #f0c030; color: #f0c030; }

  .card { background: #0b1220; border: 1px solid #14243d; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .card-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #334466; margin-bottom: 12px; font-weight: 600; }

  /* MATCHES */
  .match-list { display: flex; flex-direction: column; gap: 7px; }
  .match-row { display: grid; grid-template-columns: 1fr 42px 12px 42px 1fr; align-items: center; gap: 5px; background: #070c18; border: 1px solid #0e1a2e; border-radius: 8px; padding: 7px 10px; }
  .team-l { text-align: right; font-size: 12px; font-weight: 500; line-height: 1.3; }
  .team-r { text-align: left; font-size: 12px; font-weight: 500; line-height: 1.3; }
  .score-inp { width: 100%; text-align: center; background: #0b1220; border: 1px solid #1a2a40; color: #dde3f0; padding: 4px 2px; border-radius: 6px; font-size: 15px; font-weight: 700; font-family: 'DM Sans'; }
  .score-inp:focus { outline: none; border-color: #f0c030; }
  .score-inp:disabled { opacity: 0.35; }
  .sep { color: #1e2e4a; font-weight: 700; font-size: 13px; text-align: center; }
  .match-pts { font-size: 10px; color: #33cc66; text-align: right; grid-column: 1/-1; margin-top: 2px; }

  /* GROUP TOP 2 */
  .group-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
  .group-box { background: #070c18; border: 1px solid #0e1a2e; border-radius: 8px; padding: 11px; }
  .group-box-title { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #f0c030; margin-bottom: 9px; font-weight: 700; }
  .rank-row { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
  .rank-num { width: 17px; height: 17px; border-radius: 50%; background: #14243d; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #5566aa; font-weight: 700; flex-shrink: 0; }
  .rank-sel { flex: 1; background: #0b1220; border: 1px solid #1a2a40; color: #dde3f0; padding: 4px 6px; border-radius: 6px; font-size: 12px; font-family: 'DM Sans'; cursor: pointer; min-width: 0; }
  .rank-sel:focus { outline: none; border-color: #f0c030; }
  .rank-sel:disabled { opacity: 0.35; }

  /* R32 */
  .r32-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 6px; }

  /* QF */
  .qf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 6px; }

  /* SF RANKING */
  .sf-list { display: flex; flex-direction: column; gap: 7px; max-width: 380px; }
  .sf-row { display: flex; align-items: center; gap: 10px; }
  .sf-rank-label { font-size: 12px; color: #5566aa; width: 100px; flex-shrink: 0; }

  /* LEADERBOARD */
  .lb-list { display: flex; flex-direction: column; gap: 7px; }
  .lb-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; background: #070c18; border: 1px solid #0e1a2e; }
  .lb-row.r1 { background: #120f08; border-color: #f0c030; }
  .lb-row.r2 { background: #0a0d12; border-color: #7788aa; }
  .lb-row.r3 { background: #0e0a07; border-color: #9a6030; }
  .lb-pos { font-family: 'Bebas Neue'; font-size: 24px; width: 28px; text-align: center; }
  .lb-pos.p1 { color: #f0c030; } .lb-pos.p2 { color: #7788aa; } .lb-pos.p3 { color: #9a6030; } .lb-pos.pn { color: #1e2e4a; }
  .lb-name { flex: 1; font-size: 14px; font-weight: 500; }
  .lb-breakdown { font-size: 10px; color: #2a3a5a; margin-top: 2px; }
  .lb-pts { font-family: 'Bebas Neue'; font-size: 26px; color: #f0c030; letter-spacing: 1px; }
  .lb-lbl { font-size: 10px; color: #2a3a5a; text-transform: uppercase; }

  /* ADMIN */
  .deadline-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .dl-input { background: #070c18; border: 1px solid #1a2a40; color: #dde3f0; padding: 7px 9px; border-radius: 8px; font-family: 'DM Sans'; font-size: 13px; }
  .btn-sm { background: #14243d; border: 1px solid #1a2a40; color: #7788aa; padding: 7px 13px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: 'DM Sans'; transition: all .15s; }
  .btn-sm:hover { background: #f0c030; color: #070c18; border-color: #f0c030; }

  /* MISC */
  .notice { border-radius: 8px; padding: 10px 13px; font-size: 12px; margin-bottom: 14px; }
  .notice.warn { background: #0d1808; border: 1px solid #154a20; color: #33aa55; }
  .notice.info { background: #08100a; border: 1px solid #0e1e2e; color: #3355aa; }
  .save-row { margin-top: 20px; display: flex; align-items: center; gap: 12px; }
  .btn-save { background: #f0c030; color: #070c18; border: none; padding: 10px 26px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans'; transition: all .15s; }
  .btn-save:hover { background: #ffd440; }
  .btn-save.saved { background: #22aa55; color: #fff; }
  .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
  .spinner { display: flex; align-items: center; justify-content: center; min-height: 180px; color: #2a3a5a; font-size: 13px; }

  /* SCORING LEGEND */
  .legend { background: #0b1220; border: 1px solid #14243d; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; }
  .legend-title { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #334466; margin-bottom: 9px; font-weight: 600; }
  .legend-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 5px; }
  .legend-item { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #445566; }
  .legend-chip { background: #14243d; color: #f0c030; padding: 2px 7px; border-radius: 8px; font-size: 11px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }

  @media (max-width: 480px) {
    .match-row { grid-template-columns: 1fr 38px 10px 38px 1fr; padding: 6px 7px; gap: 3px; }
    .team-l, .team-r { font-size: 11px; }
    .score-inp { font-size: 13px; }
    .group-grid { grid-template-columns: 1fr 1fr; }
    .r32-grid, .qf-grid { grid-template-columns: 1fr 1fr; }
    .login-box { padding: 22px 14px; }
  }
`;

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [player, setPlayer] = useState(null);
  const [view, setView] = useState("login");
  const [predictTab, setPredictTab] = useState("matches");
  const [adminTab, setAdminTab] = useState("results");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [loginError, setLoginError] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineInput, setDeadlineInput] = useState("");

  // Player predictions
  const [matchPreds, setMatchPreds] = useState({});       // matchId -> {home_score, away_score}
  const [groupTopTwo, setGroupTopTwo] = useState({});     // groupId -> {first, second}
  const [r32Pred, setR32Pred] = useState(Array(32).fill(""));
  const [r16Pred, setR16Pred] = useState(Array(16).fill(""));
  const [qfPred, setQfPred] = useState(Array(8).fill(""));
  const [sfRankPred, setSfRankPred] = useState(Array(4).fill(""));  // [1st,2nd,3rd,4th]

  // Actuals (admin)
  const [actualMatches, setActualMatches] = useState({});
  const [actualGroupTopTwo, setActualGroupTopTwo] = useState({});
  const [actualR32, setActualR32] = useState(Array(32).fill(""));
  const [actualR16, setActualR16] = useState(Array(16).fill(""));
  const [actualQF, setActualQF] = useState(Array(8).fill(""));
  const [actualSFRank, setActualSFRank] = useState(Array(4).fill(""));

  const [leaderboard, setLeaderboard] = useState([]);

  const deadlinePassed = deadline && new Date() > new Date(deadline);

  // load deadline
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key","deadline").single()
      .then(({data}) => { if (data?.value) { setDeadline(data.value); setDeadlineInput(data.value.slice(0,16)); }});
  }, []);

  // load actuals
  const loadActuals = useCallback(async () => {
    const [rm, rg, rk] = await Promise.all([
      supabase.from("actual_results").select("*"),
      supabase.from("actual_group_rankings").select("*"),
      supabase.from("actual_knockout").select("*"),
    ]);
    const am = {}; (rm.data||[]).forEach(r => am[r.match_id] = r);
    setActualMatches(am);
    const ag = {}; (rg.data||[]).forEach(r => ag[r.group_id] = r.ranking);
    // Convert stored arrays to {first,second} for group top 2
    const agt2 = {};
    Object.entries(ag).forEach(([g, arr]) => {
      if (Array.isArray(arr)) agt2[g] = { first: arr[0]||"", second: arr[1]||"", third: arr[2]||"" };
    });
    setActualGroupTopTwo(agt2);
    const ak = {}; (rk.data||[]).forEach(r => ak[r.round] = r.teams);
    setActualR32(ak["R32"] || Array(32).fill(""));
    setActualR16(ak["R16"] || Array(16).fill(""));
    setActualQF(ak["QF"] || Array(8).fill(""));
    setActualSFRank(ak["SF_RANK"] || Array(4).fill(""));
  }, []);

  useEffect(() => { loadActuals(); }, [loadActuals]);

  // load player predictions
  const loadPredictions = useCallback(async (name) => {
    setLoading(true);
    const [pm, pg, pk] = await Promise.all([
      supabase.from("match_predictions").select("*").eq("player_name",name),
      supabase.from("group_ranking_predictions").select("*").eq("player_name",name),
      supabase.from("knockout_predictions").select("*").eq("player_name",name),
    ]);
    const mp = {}; (pm.data||[]).forEach(r => mp[r.match_id] = r);
    setMatchPreds(mp);
    const gt2 = {};
    (pg.data||[]).forEach(r => {
      if (Array.isArray(r.ranking)) gt2[r.group_id] = { first: r.ranking[0]||"", second: r.ranking[1]||"", third: r.ranking[2]||"" };
    });
    setGroupTopTwo(gt2);
    const kp = {}; (pk.data||[]).forEach(r => kp[r.round] = r.teams);
    setR32Pred(kp["R32"] || Array(32).fill(""));
    setR16Pred(kp["R16"] || Array(16).fill(""));
    setQfPred(kp["QF"] || Array(8).fill(""));
    setSfRankPred(kp["SF_RANK"] || Array(4).fill(""));
    setLoading(false);
  }, []);

  // leaderboard
  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    const [pm, pg, pk] = await Promise.all([
      supabase.from("match_predictions").select("*"),
      supabase.from("group_ranking_predictions").select("*"),
      supabase.from("knockout_predictions").select("*"),
    ]);
    const scores = PLAYERS.map(name => {
      const preds = {
        matches: {},
        groupTopTwo: {},
        r32: null, qf: null, sfRanking: null,
      };
      (pm.data||[]).filter(r=>r.player_name===name).forEach(r => preds.matches[r.match_id]=r);
      (pg.data||[]).filter(r=>r.player_name===name).forEach(r => {
        if (Array.isArray(r.ranking)) preds.groupTopTwo[r.group_id] = { first: r.ranking[0]||"", second: r.ranking[1]||"", third: r.ranking[2]||"" };
      });
      (pk.data||[]).filter(r=>r.player_name===name).forEach(r => {
        if (r.round==="R32") preds.r32 = r.teams;
        if (r.round==="R16") preds.r16 = r.teams;
        if (r.round==="QF") preds.qf = r.teams;
        if (r.round==="SF_RANK") preds.sfRanking = r.teams;
      });
      const actuals = {
        matches: actualMatches,
        groupTopTwo: actualGroupTopTwo,
        r32: actualR32, r16: actualR16, qf: actualQF, sfRanking: actualSFRank,
      };
      return { name, ...calcTotalScore(preds, actuals) };
    });
    scores.sort((a,b) => b.total - a.total);
    setLeaderboard(scores);
    setLoading(false);
  }, [actualMatches, actualGroupTopTwo, actualR32, actualR16, actualQF, actualSFRank]);

  async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    setLoginError("");
    const { data, error } = await supabase.from("players").select("*")
      .eq("name", form.name.value).eq("password_hash", form.password.value).single();
    if (error || !data) { setLoginError("Wrong name or password."); return; }
    setPlayer(data);
    if (data.is_admin) { setView("admin"); }
    else { await loadPredictions(data.name); setView("predict"); }
  }

  async function savePredictions() {
    setSaveState("saving");
    try {
      const matchRows = Object.entries(matchPreds).map(([match_id, r]) => ({
        player_name: player.name, match_id, home_score: r.home_score, away_score: r.away_score
      }));
      if (matchRows.length) await supabase.from("match_predictions").upsert(matchRows, {onConflict:"player_name,match_id"});

      const groupRows = Object.entries(groupTopTwo).map(([group_id, v]) => ({
        player_name: player.name, group_id, ranking: [v.first||"", v.second||"", v.third||""]
      }));
      if (groupRows.length) await supabase.from("group_ranking_predictions").upsert(groupRows, {onConflict:"player_name,group_id"});

      const koRows = [
        { player_name: player.name, round: "R32", teams: r32Pred },
        { player_name: player.name, round: "R16", teams: r16Pred },
        { player_name: player.name, round: "QF", teams: qfPred },
        { player_name: player.name, round: "SF_RANK", teams: sfRankPred },
      ];
      await supabase.from("knockout_predictions").upsert(koRows, {onConflict:"player_name,round"});

      setSaveState("saved"); setTimeout(() => setSaveState("idle"), 3000);
    } catch { setSaveState("error"); setTimeout(() => setSaveState("idle"), 3000); }
  }

  async function saveActuals() {
    setSaveState("saving");
    try {
      const matchRows = Object.entries(actualMatches).map(([match_id, r]) => ({
        match_id, home_score: r.home_score, away_score: r.away_score
      }));
      if (matchRows.length) await supabase.from("actual_results").upsert(matchRows, {onConflict:"match_id"});

      const groupRows = Object.entries(actualGroupTopTwo).map(([group_id, v]) => ({
        group_id, ranking: [v.first||"", v.second||"", v.third||""]
      }));
      if (groupRows.length) await supabase.from("actual_group_rankings").upsert(groupRows, {onConflict:"group_id"});

      const koRows = [
        { round: "R32", teams: actualR32 },
        { round: "R16", teams: actualR16 },
        { round: "QF", teams: actualQF },
        { round: "SF_RANK", teams: actualSFRank },
      ];
      await supabase.from("actual_knockout").upsert(koRows, {onConflict:"round"});

      setSaveState("saved"); setTimeout(() => setSaveState("idle"), 3000);
    } catch { setSaveState("error"); setTimeout(() => setSaveState("idle"), 3000); }
  }

  async function saveDeadline() {
    const val = deadlineInput ? new Date(deadlineInput).toISOString() : null;
    await supabase.from("app_settings").upsert({key:"deadline", value:val});
    setDeadline(val||"");
  }

  function logout() { setPlayer(null); setView("login"); }

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="app">
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
          {view==="login" && (
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
                <div>{deadlinePassed ? <span className="badge-locked">🔒 Locked</span> : <span className="badge-open">🟢 Open</span>}</div>
              </div>

              {deadlinePassed && <div className="notice warn">🔒 Deadline passed — predictions are locked.</div>}

              <div className="legend">
                <div className="legend-title">Scoring System</div>
                <div className="legend-grid">
                  <div className="legend-item"><span className="legend-chip">10</span> Correct result (W/D/L)</div>
                  <div className="legend-item"><span className="legend-chip">up to 10+10</span> Goal accuracy (per team)</div>
                  <div className="legend-item"><span className="legend-chip">+10</span> Exact score bonus</div>
                  <div className="legend-item"><span className="legend-chip">max 40</span> Per match total</div>
                  <div className="legend-item"><span className="legend-chip">5 (+5)</span> Group top-3 (+ correct rank)</div>
                  <div className="legend-item"><span className="legend-chip">10</span> Per R32 qualifier correctly predicted</div>
                  <div className="legend-item"><span className="legend-chip">15</span> Per R16 team correctly predicted</div>
                  <div className="legend-item"><span className="legend-chip">20</span> Per QF team correctly predicted</div>
                  <div className="legend-item"><span className="legend-chip">25 (+5)</span> Per SF team (+ correct final rank)</div>
                </div>
              </div>

              <div className="tab-row">
                {[["matches","⚽ Match Scores"],["groups","📊 Group Top 3"],["r32","R32 Qualifiers"],["r16","R16"],["qf","🏆 Quarter-Finals"],["sf","🥇 Final Ranking"]].map(([k,l]) => (
                  <button key={k} className={`tab ${predictTab===k?"active":""}`} onClick={()=>setPredictTab(k)}>{l}</button>
                ))}
              </div>

              {loading ? <div className="spinner">Loading…</div> : <>

                {/* MATCH SCORES */}
                {predictTab==="matches" && Object.entries(GROUPS).map(([grp]) => (
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
                              value={p.home_score??""} placeholder="0" disabled={deadlinePassed}
                              onChange={e => setMatchPreds(prev=>({...prev,[m.id]:{...prev[m.id],home_score:e.target.value}}))} />
                            <div className="sep">–</div>
                            <input className="score-inp" type="number" min="0" max="20"
                              value={p.away_score??""} placeholder="0" disabled={deadlinePassed}
                              onChange={e => setMatchPreds(prev=>({...prev,[m.id]:{...prev[m.id],away_score:e.target.value}}))} />
                            <div className="team-r">{m.away} {f(m.away)}</div>
                            {sc!==null && <div className="match-pts">+{sc.total}pts (result {sc.result} · accuracy {sc.accuracy} · exact {sc.exact})</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* GROUP TOP 2 */}
                {predictTab==="groups" && (
                  <div className="card">
                    <div className="card-label">Predict 1st, 2nd and 3rd place per group — 5pts per team advancing, +5pts for correct rank</div>
                    <div className="group-grid">
                      {Object.entries(GROUPS).map(([grp, teams]) => {
                        const v = groupTopTwo[grp]||{first:"",second:""};
                        return (
                          <div key={grp} className="group-box">
                            <div className="group-box-title">Group {grp}</div>
                            {["first","second","third"].map((rank,i) => (
                              <div key={rank} className="rank-row">
                                <div className="rank-num">{i+1}</div>
                                <select className="rank-sel" disabled={deadlinePassed}
                                  value={v[rank]||""}
                                  onChange={e => setGroupTopTwo(prev=>({...prev,[grp]:{...prev[grp],[rank]:e.target.value}}))}>
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

                {/* R32 */}
                {predictTab==="r32" && (
                  <div className="card">
                    <div className="card-label">All 32 teams that qualify for the Round of 32 — 10pts per correct team (includes 8 best 3rd-place teams)</div>
                    <div className="r32-grid">
                      {Array(32).fill(0).map((_,i) => (
                        <select key={i} className="rank-sel" disabled={deadlinePassed}
                          value={r32Pred[i]||""}
                          onChange={e => { const u=[...r32Pred]; u[i]=e.target.value; setR32Pred(u); }}>
                          <option value="">— pick {i+1} —</option>
                          {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                        </select>
                      ))}
                    </div>
                  </div>
                )}

                {/* QF */}
                {predictTab==="r16" && (
                  <div className="card">
                    <div className="card-label">16 teams reaching the Round of 16 — 15pts per correct team</div>
                    <div className="r32-grid">
                      {Array(16).fill(0).map((_,i) => (
                        <select key={i} className="rank-sel" disabled={deadlinePassed}
                          value={r16Pred[i]||""}
                          onChange={e => { const u=[...r16Pred]; u[i]=e.target.value; setR16Pred(u); }}>
                          <option value="">— pick {i+1} —</option>
                          {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                        </select>
                      ))}
                    </div>
                  </div>
                )}

                {predictTab==="qf" && (
                  <div className="card">
                    <div className="card-label">8 teams reaching the Quarter-Finals — 20pts per correct team</div>
                    <div className="qf-grid">
                      {Array(8).fill(0).map((_,i) => (
                        <select key={i} className="rank-sel" disabled={deadlinePassed}
                          value={qfPred[i]||""}
                          onChange={e => { const u=[...qfPred]; u[i]=e.target.value; setQfPred(u); }}>
                          <option value="">— pick {i+1} —</option>
                          {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                        </select>
                      ))}
                    </div>
                  </div>
                )}

                {/* SF / FINAL RANKING */}
                {predictTab==="sf" && (
                  <div className="card">
                    <div className="card-label">Final standings: predict exact 1st–4th place — 25pts per team + 5pts for correct final rank</div>
                    <div className="sf-list">
                      {FINAL_RANKS.map((label,i) => (
                        <div key={i} className="sf-row">
                          <div className="sf-rank-label">{label}</div>
                          <select className="rank-sel" style={{maxWidth:220}} disabled={deadlinePassed}
                            value={sfRankPred[i]||""}
                            onChange={e => { const u=[...sfRankPred]; u[i]=e.target.value; setSfRankPred(u); }}>
                            <option value="">— pick team —</option>
                            {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!deadlinePassed && (
                  <div className="save-row">
                    <button className={`btn-save ${saveState==="saved"?"saved":""}`} disabled={saveState==="saving"} onClick={savePredictions}>
                      {saveState==="saving"?"Saving…":saveState==="saved"?"✓ Saved!":"Save Predictions"}
                    </button>
                    {saveState==="error" && <span style={{color:"#cc3333",fontSize:12}}>Save failed — check your connection</span>}
                  </div>
                )}
              </>}
            </>
          )}

          {/* ADMIN */}
          {view==="admin" && player?.is_admin && (
            <>
              <div className="section-title" style={{marginBottom:18}}>🔧 Admin Panel</div>

              <div className="card">
                <div className="card-label">Submission Deadline</div>
                <div className="deadline-row">
                  <input className="dl-input" type="datetime-local" value={deadlineInput} onChange={e=>setDeadlineInput(e.target.value)} />
                  <button className="btn-sm" onClick={saveDeadline}>Set</button>
                  {deadline && (deadlinePassed ? <span className="badge-locked">🔒 Locked</span> : <span className="badge-open">🟢 Open</span>)}
                </div>
              </div>

              <div className="tab-row">
                {[["results","⚽ Match Results"],["groups","📊 Group Top 3"],["r32","R32"],["r16","R16"],["qf","QF"],["sf","Final Ranking"]].map(([k,l]) => (
                  <button key={k} className={`tab ${adminTab===k?"active":""}`} onClick={()=>setAdminTab(k)}>{l}</button>
                ))}
              </div>

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

              {adminTab==="groups" && (
                <div className="card">
                  <div className="card-label">Actual 1st, 2nd and 3rd place per group</div>
                  <div className="group-grid">
                    {Object.entries(GROUPS).map(([grp, teams]) => {
                      const v = actualGroupTopTwo[grp]||{first:"",second:""};
                      return (
                        <div key={grp} className="group-box">
                          <div className="group-box-title">Group {grp}</div>
                          {["first","second","third"].map((rank,i) => (
                            <div key={rank} className="rank-row">
                              <div className="rank-num">{i+1}</div>
                              <select className="rank-sel" value={v[rank]||""}
                                onChange={e=>setActualGroupTopTwo(prev=>({...prev,[grp]:{...prev[grp],[rank]:e.target.value}}))}>
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

              {adminTab==="r32" && (
                <div className="card">
                  <div className="card-label">All 32 actual R32 qualifiers</div>
                  <div className="r32-grid">
                    {Array(32).fill(0).map((_,i) => (
                      <select key={i} className="rank-sel" value={actualR32[i]||""}
                        onChange={e=>{const u=[...actualR32];u[i]=e.target.value;setActualR32(u);}}>
                        <option value="">— team {i+1} —</option>
                        {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                      </select>
                    ))}
                  </div>
                </div>
              )}

              {adminTab==="r16" && (
                <div className="card">
                  <div className="card-label">16 actual Round of 16 teams</div>
                  <div className="r32-grid">
                    {Array(16).fill(0).map((_,i) => (
                      <select key={i} className="rank-sel" value={actualR16[i]||""}
                        onChange={e=>{const u=[...actualR16];u[i]=e.target.value;setActualR16(u);}}>
                        <option value="">— team {i+1} —</option>
                        {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                      </select>
                    ))}
                  </div>
                </div>
              )}

              {adminTab==="qf" && (
                <div className="card">
                  <div className="card-label">8 actual Quarter-Finalists</div>
                  <div className="qf-grid">
                    {Array(8).fill(0).map((_,i) => (
                      <select key={i} className="rank-sel" value={actualQF[i]||""}
                        onChange={e=>{const u=[...actualQF];u[i]=e.target.value;setActualQF(u);}}>
                        <option value="">— team {i+1} —</option>
                        {ALL_TEAMS.map(t=><option key={t} value={t}>{f(t)} {t}</option>)}
                      </select>
                    ))}
                  </div>
                </div>
              )}

              {adminTab==="sf" && (
                <div className="card">
                  <div className="card-label">Actual final standings (1st–4th)</div>
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
              {!deadlinePassed && <div className="notice info">👁 Predictions hidden until deadline. Scores reflect results entered so far.</div>}
              {loading ? <div className="spinner">Calculating…</div> : (
                <div className="lb-list">
                  {leaderboard.map((e,idx) => (
                    <div key={e.name} className={`lb-row ${idx===0?"r1":idx===1?"r2":idx===2?"r3":""}`}>
                      <div className={`lb-pos p${idx<3?idx+1:"n"}`}>{idx+1}</div>
                      <div>
                        <div className="lb-name">{e.name}</div>
                        <div className="lb-breakdown">
                          Matches {e.matchPts} · Groups {e.groupPts} · R32 {e.r32Pts} · R16 {e.r16Pts} · QF {e.qfPts} · SF/Final {e.sfPts}
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
