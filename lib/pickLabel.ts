// lib/pickLabel.ts
// Shared display label for a pick. Spreads and totals are already
// self-explanatory (a +/- number, or "Over"/"Under"), but a moneyline
// (h2h) pick has no line — "Kansas City Chiefs" alone doesn't say whether
// it's a moneyline pick or a spread pick missing its number. Tag it.
export type PickLike = { market: string | null; team: string | null; line: string | null };

// Stored lines are the raw numeric string from the odds feed (e.g. "47",
// "-3.5") — positive values never carry their own "+", so every display
// site needs to add it back rather than showing a bare "47" that reads as
// unsigned.
export function formatLine(line: string | null | undefined): string {
  if (!line) return "";
  return line.startsWith("-") ? line : `+${line}`;
}

export function pickLabel(p: PickLike | null): string | null {
  if (!p || !p.team) return null;
  if (p.market === "h2h") return `${p.team} ML`;
  return p.line ? `${p.team} ${formatLine(p.line)}` : p.team;
}

// A totals pick's own label ("Over +47.5") doesn't say which game it's
// for — unlike a spread/moneyline pick, where the team name IS the game.
// Every totals pick display needs the matchup appended; this is the one
// place that decides when (only totals, only when the game is known).
export function matchupSuffix(market: string | null, game?: { home: string; away: string } | null): string | null {
  if (market !== "totals" || !game) return null;
  return `${game.away} @ ${game.home}`;
}
