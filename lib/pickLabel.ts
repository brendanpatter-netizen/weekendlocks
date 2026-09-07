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
