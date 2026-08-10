// lib/mockOdds.ts
// Deterministic fake odds so the picks pages can be exercised end-to-end
// without spending real Odds-API credits. Only used when
// EXPO_PUBLIC_ODDS_MOCK is set (see lib/useOdds.ts) — never touches the
// network or the real API key.
import { getWeekRange as getNflWeekRange } from "./nflWeeks";
import { getCfbWeekRange } from "./cfbWeeks";
import type { Game } from "./useOdds";

const NFL_MATCHUPS: [string, string][] = [
  ["Kansas City Chiefs", "Buffalo Bills"],
  ["Philadelphia Eagles", "Dallas Cowboys"],
  ["San Francisco 49ers", "Seattle Seahawks"],
  ["Detroit Lions", "Green Bay Packers"],
  ["Baltimore Ravens", "Cincinnati Bengals"],
  ["Miami Dolphins", "New York Jets"],
];

const CFB_MATCHUPS: [string, string][] = [
  ["Georgia Bulldogs", "Alabama Crimson Tide"],
  ["Ohio State Buckeyes", "Michigan Wolverines"],
  ["Texas Longhorns", "Oklahoma Sooners"],
  ["LSU Tigers", "Florida Gators"],
  ["Oregon Ducks", "Washington Huskies"],
  ["Notre Dame Fighting Irish", "USC Trojans"],
];

// Small deterministic PRNG so mock lines are stable across reloads for the
// same sport+week instead of jumping around every refresh.
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeGame(id: string, home: string, away: string, commence: Date, rand: () => number): Game {
  const spread = Math.round((rand() * 12 + 1) * 2) / 2; // 0.5 .. 13, half-point steps
  const total = Math.round((rand() * 20 + 38) * 2) / 2; // 38 .. 58
  const homeFavored = rand() > 0.5;

  return {
    id,
    commence_time: commence.toISOString(),
    home_team: home,
    away_team: away,
    bookmakers: [
      {
        key: "mock_book",
        last_update: new Date().toISOString(),
        markets: [
          {
            key: "spreads",
            outcomes: [
              { name: home, point: homeFavored ? -spread : spread, price: -110 },
              { name: away, point: homeFavored ? spread : -spread, price: -110 },
            ],
          },
          {
            key: "totals",
            outcomes: [
              { name: "Over", point: total, price: -110 },
              { name: "Under", point: total, price: -110 },
            ],
          },
          {
            key: "h2h",
            outcomes: [
              { name: home, price: homeFavored ? -160 : 140 },
              { name: away, price: homeFavored ? 140 : -160 },
            ],
          },
        ],
      },
    ],
  };
}

export function getMockGames(sportKey: string, week: number): Game[] {
  const isNfl = sportKey.includes("nfl");
  const matchups = isNfl ? NFL_MATCHUPS : CFB_MATCHUPS;
  const { start, end } = isNfl ? getNflWeekRange(week) : getCfbWeekRange(week);
  const windowMs = Math.max(end.getTime() - start.getTime(), 1);
  const rand = seededRandom(week * (isNfl ? 1000 : 2000) + 7);

  return matchups.map(([home, away], i) => {
    const offset = Math.floor((windowMs / (matchups.length + 1)) * (i + 1));
    const commence = new Date(start.getTime() + offset);
    return makeGame(`mock-${sportKey}-w${week}-${i}`, home, away, commence, rand);
  });
}
