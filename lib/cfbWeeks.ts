// lib/cfbWeeks.ts
export type WeekRangeISO = { week: number; start: string; end: string };

// Generate weekly UTC windows as ISO strings (always 'Z')
function genWeeks(startUtc: Date, weeks: number): WeekRangeISO[] {
  const out: WeekRangeISO[] = [];
  for (let i = 0; i < weeks; i++) {
    const s = new Date(startUtc.getTime() + i * 7 * 86400000);
    const e = new Date(s.getTime() + 7 * 86400000);
    out.push({ week: i + 1, start: s.toISOString(), end: e.toISOString() });
  }
  return out;
}

// 2025 CFB: open Tue Aug 26 00:00:00Z
const CFB_SEASON_OPEN_UTC = new Date(Date.UTC(2025, 7, 26, 0, 0, 0)); // 2025-08-26T00:00:00Z
export const cfbWeeks: WeekRangeISO[] = genWeeks(CFB_SEASON_OPEN_UTC, 15);

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

/** Reliable “current CFB week” in UTC */
export function getCurrentCfbWeek(at?: unknown): number {
  const t = toMillis(at);
  for (const w of cfbWeeks) if (t >= Date.parse(w.start) && t < Date.parse(w.end)) return w.week;
  if (t < Date.parse(cfbWeeks[0].start)) return cfbWeeks[0].week;
  return cfbWeeks[cfbWeeks.length - 1].week;
}

/** Back-compat: return Date objects so existing code can call .getTime() */
export function getWeekRange(week: number): { start: Date; end: Date } {
  const w = cfbWeeks.find((x) => x.week === week) ?? cfbWeeks[cfbWeeks.length - 1];
  return { start: new Date(w.start), end: new Date(w.end) };
}

/** If you need ISO strings explicitly */
export function getWeekIsoRange(week: number): { start: string; end: string } {
  const w = cfbWeeks.find((x) => x.week === week) ?? cfbWeeks[cfbWeeks.length - 1];
  return { start: w.start, end: w.end };
}

/** Back-compat alias some code may import */
export const getCfbWeekRange = getWeekRange;
