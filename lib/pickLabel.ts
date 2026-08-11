// lib/pickLabel.ts
// Shared display label for a pick. Spreads and totals are already
// self-explanatory (a +/- number, or "Over"/"Under"), but a moneyline
// (h2h) pick has no line — "Kansas City Chiefs" alone doesn't say whether
// it's a moneyline pick or a spread pick missing its number. Tag it.
export type PickLike = { market: string | null; team: string | null; line: string | null };

export function pickLabel(p: PickLike | null): string | null {
  if (!p || !p.team) return null;
  if (p.market === "h2h") return `${p.team} ML`;
  return p.line ? `${p.team} ${p.line}` : p.team;
}
