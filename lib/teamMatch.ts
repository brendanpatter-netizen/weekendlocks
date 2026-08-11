// lib/teamMatch.ts
// Shared fuzzy team-name matching, previously duplicated in
// app/picks/page.tsx, app/picks/college.tsx, and now lib/scores.ts.
export function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, "and")
    .replace(/\s+st\./g, " state")
    .replace(/[\s\-]+/g, " ")
    .trim();
}

export const NFL_ALIASES: Record<string, string> = {
  "ny giants": "new york giants",
  giants: "new york giants",
  "ny jets": "new york jets",
  jets: "new york jets",
  "la rams": "los angeles rams",
  rams: "los angeles rams",
  "la chargers": "los angeles chargers",
  chargers: "los angeles chargers",
  jax: "jacksonville jaguars",
  bucs: "tampa bay buccaneers",
  "no saints": "new orleans saints",
  "ne patriots": "new england patriots",
  "gb packers": "green bay packers",
  "kc chiefs": "kansas city chiefs",
  "lv raiders": "las vegas raiders",
  "ari cardinals": "arizona cardinals",
  "sf 49ers": "san francisco 49ers",
  "sea seahawks": "seattle seahawks",
  tb: "tampa bay buccaneers",
  wsh: "washington commanders",
};

export function aliasNFL(name: string): string {
  return NFL_ALIASES[norm(name)] ?? norm(name);
}

function normFor(name: string, league: "nfl" | "cfb"): string {
  return league === "nfl" ? aliasNFL(name) : norm(name);
}

/** Loose substring match, tolerant of home/away order and partial names. */
export function teamsLikelyMatch(a: string, b: string, league: "nfl" | "cfb"): boolean {
  const na = normFor(a, league);
  const nb = normFor(b, league);
  return na.includes(nb) || nb.includes(na);
}

/**
 * Does (rHome, rAway) match (feedHome, feedAway), allowing either the same
 * order or swapped — feeds don't always agree on which side is "home".
 */
export function matchupsLikelyMatch(
  rHome: string, rAway: string, feedHome: string, feedAway: string, league: "nfl" | "cfb"
): boolean {
  const dir = teamsLikelyMatch(rHome, feedHome, league) && teamsLikelyMatch(rAway, feedAway, league);
  const swap = teamsLikelyMatch(rHome, feedAway, league) && teamsLikelyMatch(rAway, feedHome, league);
  return dir || swap;
}
