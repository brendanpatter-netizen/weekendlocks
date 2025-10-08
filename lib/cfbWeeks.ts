// lib/cfbWeeks.ts
export type WeekRange = { week: number; start: string; end: string };

// Generate weekly UTC windows
function genWeeks(startUtc: Date, weeks: number): WeekRange[] {
  const out: WeekRange[] = [];
  for (let i = 0; i < weeks; i++) {
    const s = new Date(startUtc.getTime() + i * 7 * 86400000);
    const e = new Date(s.getTime() + 7 * 86400000);
    out.push({ week: i + 1, start: s.toISOString(), end: e.toISOString() });
  }
  return out;
}

/**
 * CFB 2025: “Week 1” opens at 00:00 UTC on Tue Aug 26, 2025.
 * Close the following Tue 00:00Z. Adjust if you later load weeks from DB.
 */
const CFB_SEASON_OPEN_UTC = new Date(Date.UTC(2025, 7, 26, 0, 0, 0)); // 2025-08-26T00:00:00Z
export const cfbWeeks: WeekRange[] = genWeeks(CFB_SEASON_OPEN_UTC, 15);

/** Return the current CFB week based on the UTC windows above. */
export function getCurrentCfbWeek(at: Date = new Date()): number {
  const t = at.getTime();
  for (const w of cfbWeeks) {
    if (t >= Date.parse(w.start) && t < Date.parse(w.end)) return w.week;
  }
  if (t < Date.parse(cfbWeeks[0].start)) return cfbWeeks[0].week;
  return cfbWeeks[cfbWeeks.length - 1].week;
}
