import { GROUP_MATCHES, KO_ROUNDS, GROUPS, GLOBAL_DEADLINE } from "./constants";

export function scoreMatch(pred, actual) {
  if (!pred || !actual || pred.home_score == null || actual.home_score == null)
    return { total: 0, result: 0, accuracy: 0, exact: 0 };
  const ph = +pred.home_score, pa = +pred.away_score;
  const ah = +actual.home_score, aa = +actual.away_score;
  if (isNaN(ph) || isNaN(pa) || isNaN(ah) || isNaN(aa))
    return { total: 0, result: 0, accuracy: 0, exact: 0 };
  // 10-10 is the default sentinel — always scores 0
  if (ph === 10 && pa === 10)
    return { total: 0, result: 0, accuracy: 0, exact: 0 };
  const pRes = ph > pa ? "H" : ph < pa ? "A" : "D";
  const aRes = ah > aa ? "H" : ah < aa ? "A" : "D";
  const result = pRes === aRes ? 10 : 0;
  const accuracy = Math.max(0, 10 - Math.abs(ph - ah)) + Math.max(0, 10 - Math.abs(pa - aa));
  const exact = ph === ah && pa === aa ? 10 : 0;
  return { total: result + accuracy + exact, result, accuracy, exact };
}

export function scoreGroupTopThree(pred, actual) {
  if (!pred || !actual) return 0;
  let pts = 0;
  ["first", "second", "third"].forEach(rank => {
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

export function scoreKOQualifiers(predTeams, actualTeams, pts) {
  if (!predTeams || !actualTeams) return 0;
  return predTeams.filter(t => t && actualTeams.includes(t)).length * pts;
}

export function scoreSFRanking(pred, actual) {
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

export function calcTotalScore(preds, actuals) {
  let matchPts = 0, groupPts = 0, r32Pts = 0, r16Pts = 0, qfPts = 0, sfPts = 0;
  let koMatchPts = 0;

  GROUP_MATCHES.forEach(m => {
    matchPts += scoreMatch(preds.matches?.[m.id], actuals.matches?.[m.id]).total;
  });

  KO_ROUNDS.forEach(r => {
    (preds.koMatches?.[r.id] || []).forEach((pred, i) => {
      koMatchPts += scoreMatch(pred, actuals.koMatches?.[r.id]?.[i]).total;
    });
  });

  Object.keys(GROUPS).forEach(g => {
    groupPts += scoreGroupTopThree(preds.groupTopThree?.[g], actuals.groupTopThree?.[g]);
  });

  r32Pts = scoreKOQualifiers(preds.r32, actuals.r32, 10);
  r16Pts = scoreKOQualifiers(preds.r16, actuals.r16, 15);
  qfPts  = scoreKOQualifiers(preds.qf,  actuals.qf,  20);
  sfPts  = scoreSFRanking(preds.sfRanking, actuals.sfRanking);

  const total = matchPts + koMatchPts + groupPts + r32Pts + r16Pts + qfPts + sfPts;
  return { total, matchPts, koMatchPts, groupPts, r32Pts, r16Pts, qfPts, sfPts };
}

export function isPast(isoString) {
  if (!isoString) return false;
  return new Date() > new Date(isoString);
}

export function currentOpenRound() {
  if (!isPast(GLOBAL_DEADLINE)) return "GROUP";
  for (const r of KO_ROUNDS) {
    // Lock at whichever comes first: the explicit deadline or the first kickoff
    const deadlineMs = new Date(r.deadline).getTime();
    const kickoffMs  = r.firstKickoff ? new Date(r.firstKickoff).getTime() : Infinity;
    if (Date.now() < Math.min(deadlineMs, kickoffMs)) return r.id;
  }
  return "CLOSED";
}

export function formatDeadline(isoString, tzLabel) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return (
    d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + ` (${tzLabel})`
  );
}
