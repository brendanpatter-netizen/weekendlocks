// lib/records.ts
// A push counts as a win (house rule) — win/loss aggregates below don't
// track pushes separately, they're already folded into wins.
export type SeasonRecord = { wins: number; losses: number };
export const EMPTY_RECORD: SeasonRecord = { wins: 0, losses: 0 };

export function recordLabel(r: SeasonRecord): string | null {
  if (r.wins === 0 && r.losses === 0) return null;
  return `${r.wins}-${r.losses}`;
}

export function winPct(r: SeasonRecord): string | null {
  const decided = r.wins + r.losses;
  if (decided === 0) return null;
  return `${Math.round((100 * r.wins) / decided)}%`;
}
