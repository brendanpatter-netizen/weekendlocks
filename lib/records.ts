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

// A little flavor for extreme records — needs at least 3 decided games so a
// single early result doesn't get crowned a "heater."
export function recordVibe(r: SeasonRecord): string | null {
  const decided = r.wins + r.losses;
  if (decided < 3) return null;
  const pct = r.wins / decided;
  if (pct >= 0.75) return "🔥 Heater";
  if (pct <= 0.25) return "🥶 Ice cold";
  return null;
}
