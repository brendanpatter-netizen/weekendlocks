// lib/nflWeeks.ts
export type WeekRange = { week: number; start: string; end: string };

// Generate weekly UTC windows as ISO strings (always includes 'Z')
function genWeeks(startUtc: Date, weeks: number): WeekRange[] {
  const out: WeekRange[] = [];
  for (let i = 0; i < weeks; i++) {
    const s = new Date(startUtc.getTime() + i * 7 * 86400000);
    const e = new Date(s.getTime() + 7 * 86400000);
    out.push({ week: i + 1, start: s.toISOString(), end: e.toISOString() });
  }
  return out;
}

// 2025 NFL: kickoff Thu Sep 4 → open Tue Sep 2 00:00:00Z, weekly windows
const NFL_SEASON_OPEN_UTC = new Date(Date.UTC(2025, 8, 2, 0, 0, 0)); // 2025-09-02T00:00:00Z
export const nflWeeks: WeekRange[] = genWeeks(NFL_SEASON_OPEN_UTC, 18);

// --- helpers -----------------------------------------------------------------

function toMillis(at?: unknown): number {
  if (at instanceof Date) return at.getTime();
  if (typeof at === "number") return at;
  if (typeof at === "string") {
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return Date.now();
}

/** Reliable “current NFL week” in UTC */
export function getCurrentWeek(at?: unknown): number {
  const t = toMillis(at);
  for (const w of nflWeeks) if (t >= Date.parse(w.start) && t < Date.parse(w.end)) return w.week;
  if (t < Date.parse(nflWeeks[0].start)) return nflWeeks[0].week;
  return nflWeeks[nflWeeks.length - 1].week;
}

/** Back-compat: (start,end) ISO window for a given week */
export function getWeekRange(week: number): { start: string; end: string } {
  const w = nflWeeks.find((x) => x.week === week) ?? nflWeeks[nflWeeks.length - 1];
  return { start: w.start, end: w.end };
}

/** Back-compat alias used by older code */
export const getNflWeekRange = getWeekRange;
