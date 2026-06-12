export const GROUPS = {
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

export const ALL_TEAMS = Object.values(GROUPS).flat();
export const SORTED_TEAMS = [...ALL_TEAMS].sort((a, b) => a.localeCompare(b));

export const GROUP_MATCHES = [
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

export const PLAYERS = ["David", "Dorian", "Antonia", "Irma", "Laura", "Dorus", "Sandra", "Hilde", "Eric", "Claude"];

export const PLAYER_COLORS = {
  "David":   "#33cc66",
  "Dorian":  "#f0c030",
  "Antonia": "#00d8f6",
  "Irma":    "#e040fb",
  "Laura":   "#ff5252",
  "Dorus":   "#ff9100",
  "Sandra":  "#2979ff",
  "Hilde":   "#00e676",
  "Eric":    "#ffd600",
  "Claude":  "#b388ff",
};

export const FINAL_RANKS = ["1st (Winner)", "2nd (Runner-up)", "3rd place", "4th place"];

export const KO_ROUNDS = [
  // deadline   = picks lock (manual cut-off, set conservatively before first game)
  // firstKickoff = auto-lock safety net — picks also lock when first game of the round actually starts
  { id: "R32",   label: "Round of 32",    games: 16, deadline: "2026-06-28T07:00:00-07:00", tzLabel: "Los Angeles time", firstKickoff: "2026-06-28T19:00:00Z" },
  { id: "R16",   label: "Round of 16",    games: 8,  deadline: "2026-07-04T07:00:00-05:00", tzLabel: "Houston time",     firstKickoff: "2026-07-04T18:00:00Z" },
  { id: "QF",    label: "Quarter-Finals", games: 4,  deadline: "2026-07-08T23:59:00-04:00", tzLabel: "EDT",              firstKickoff: "2026-07-09T19:00:00Z" },
  { id: "SF",    label: "Semi-Finals",    games: 2,  deadline: "2026-07-13T23:59:00-04:00", tzLabel: "EDT",              firstKickoff: "2026-07-14T19:00:00Z" },
  { id: "FINAL", label: "Bronze & Final", games: 2,  deadline: "2026-07-17T23:59:00-04:00", tzLabel: "EDT",              firstKickoff: "2026-07-18T19:00:00Z" },
];

export const GLOBAL_DEADLINE = "2026-06-10T23:59:00+01:00";

// All 16 R32 matches in bracket order.
// type W = group winner, R = runner-up, 3 = 3rd-place team (col = FIFA table column index)
export const R32_MATCHES = [
  { match:"M73", home:{type:"R",grp:"A"}, away:{type:"R",grp:"B"} },
  { match:"M74", home:{type:"W",grp:"E"}, away:{type:"3",col:3}   },
  { match:"M75", home:{type:"W",grp:"F"}, away:{type:"R",grp:"C"} },
  { match:"M76", home:{type:"W",grp:"C"}, away:{type:"R",grp:"F"} },
  { match:"M77", home:{type:"W",grp:"I"}, away:{type:"3",col:5}   },
  { match:"M78", home:{type:"R",grp:"E"}, away:{type:"R",grp:"I"} },
  { match:"M79", home:{type:"W",grp:"A"}, away:{type:"3",col:0}   },
  { match:"M80", home:{type:"W",grp:"L"}, away:{type:"3",col:7}   },
  { match:"M81", home:{type:"W",grp:"D"}, away:{type:"3",col:2}   },
  { match:"M82", home:{type:"W",grp:"G"}, away:{type:"3",col:4}   },
  { match:"M83", home:{type:"R",grp:"K"}, away:{type:"R",grp:"L"} },
  { match:"M84", home:{type:"W",grp:"H"}, away:{type:"R",grp:"J"} },
  { match:"M85", home:{type:"W",grp:"B"}, away:{type:"3",col:1}   },
  { match:"M86", home:{type:"W",grp:"J"}, away:{type:"R",grp:"H"} },
  { match:"M87", home:{type:"W",grp:"K"}, away:{type:"3",col:6}   },
  { match:"M88", home:{type:"R",grp:"D"}, away:{type:"R",grp:"G"} },
];

export const FLAGS = {
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

export const f = t => FLAGS[t] || "🏳️";
