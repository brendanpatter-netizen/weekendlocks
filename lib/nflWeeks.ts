// lib/nflWeeks.ts
export type WeekRange = { week: number; start: string; end: string };

// Helper to generate weekly UTC windows with ISO strings
function genWeeks(
  startUtc: Date, // inclusive
  weeks: number
): WeekRange[] {
  const out: WeekRange[] = [];
  for (let i = 0; i < weeks; i++) {
    const s = new Date(startUtc.getTime() + i * 7 * 86400000);
    const e = new Date(s.getTime() + 7 * 86400000);
    out.push({
      week: i + 1,
      start: s.toISOString(), // <- includes 'Z'
      end: e.toISOString(),
    });
  }
  return out;
}

/**
 * NFL 2025: open each “betting week” at 00:00 UTC on the Tue of kickoff week.
 * (Kickoff is Thu Sep 4, 2025; use Tue Sep 2, 2025, 00:00:00Z as the open.)
 * Close the following Tue 00:00Z.
 */
const NFL_SEASON_OPEN_UTC = new Date(Date.UTC(2025, 8, 2, 0, 0, 0)); // 2025-09-02T00:00:00Z
export const nflWeeks: WeekRange[] = genWeeks(NFL_SEASON_OPEN_UTC, 18);

/** Return the current NFL week based on the UTC windows above. */
export function getCurrentWeek(at: Date = new Date()): number {
  const t = at.getTime();
  for (const w of nflWeeks) {
    if (t >= Date.parse(w.start) && t < Date.parse(w.end)) return w.week;
  }
  if (t < Date.parse(nflWeeks[0].start)) return nflWeeks[0].week;
  return nflWeeks[nflWeeks.length - 1].week;
}
