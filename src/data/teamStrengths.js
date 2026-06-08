/**
 * Team strength data for tournament bracket simulation.
 *
 * FIFA_RANKINGS  — April 2026 official update (last before tournament).
 *                  Lower number = stronger team.
 *
 * OPTA_WIN_PCT   — Opta Supercomputer pre-tournament win probabilities (%)
 *                  based on 25,000 simulations.
 *
 * Team names MUST match exactly the names used in src/constants.js GROUPS.
 */

export const FIFA_RANKINGS = {
  // Top 10
  "France":                  1,
  "Spain":                   2,
  "Argentina":               3,
  "England":                 4,
  "Portugal":                5,
  "Brazil":                  6,
  "Netherlands":             7,
  "Morocco":                 8,
  "Belgium":                 9,
  "Germany":                 10,
  // 11-20
  "Croatia":                 11,
  "Colombia":                13,
  "Senegal":                 14,
  "Mexico":                  15,
  "United States":           16,
  "Uruguay":                 17,
  "Japan":                   18,
  "Switzerland":             19,
  // 21-30
  "Iran":                    21,
  "Türkiye":                 22,
  "Ecuador":                 23,
  "Austria":                 24,
  "South Korea":             25,
  "Australia":               27,
  "Algeria":                 28,
  "Egypt":                   29,
  "Canada":                  30,
  // 31-50
  "Norway":                  31,
  "Panama":                  33,
  "Ivory Coast":             34,
  "Sweden":                  38,
  "Paraguay":                40,
  "Czechia":                 41,
  "Scotland":                43,
  "Tunisia":                 44,
  "Congo DR":                46,
  "Uzbekistan":              50,
  // Outside top 50
  "Qatar":                   55,
  "Iraq":                    57,
  "South Africa":            60,
  "Saudi Arabia":            61,
  "Jordan":                  63,
  "Bosnia and Herzegovina":  65,
  "Cape Verde":              69,
  "Ghana":                   74,
  "Curacao":                 82,
  "Haiti":                   83,
  "New Zealand":             85,
};

export const OPTA_WIN_PCT = {
  // Top 10
  "Spain":                   16.04,
  "France":                  12.76,
  "England":                 11.36,
  "Argentina":               10.35,
  "Portugal":                6.82,
  "Brazil":                  6.45,
  "Germany":                 5.43,
  "Netherlands":             3.80,
  "Norway":                  3.36,
  "Belgium":                 2.46,
  // 11-20
  "Colombia":                2.03,
  "Morocco":                 1.82,
  "Uruguay":                 1.66,
  "Ecuador":                 1.58,
  "Croatia":                 1.50,
  "Switzerland":             1.47,
  "Japan":                   1.40,
  "United States":           1.40,
  "Türkiye":                 1.03,
  "Mexico":                  0.96,
  // 21-30
  "Senegal":                 0.91,
  "Austria":                 0.53,
  "Paraguay":                0.53,
  "Sweden":                  0.47,
  "Canada":                  0.44,
  "South Korea":             0.39,
  "Australia":               0.38,
  "Egypt":                   0.33,
  "Czechia":                 0.30,
  "Algeria":                 0.24,
  // 31-40
  "Bosnia and Herzegovina":  0.24,
  "Ghana":                   0.23,
  "Scotland":                0.23,
  "Iran":                    0.20,
  "Ivory Coast":             0.20,
  "Tunisia":                 0.10,
  "Panama":                  0.09,
  "Congo DR":                0.09,
  "New Zealand":             0.07,
  "Iraq":                    0.06,
  // 41-48
  "Qatar":                   0.06,
  "South Africa":            0.06,
  "Saudi Arabia":            0.05,
  "Cape Verde":              0.05,
  "Uzbekistan":              0.04,
  "Jordan":                  0.04,
  "Curacao":                 0.00,
  "Haiti":                   0.00,
};
