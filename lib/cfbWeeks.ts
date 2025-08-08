// lib/cfbWeeks.ts
const MS7 = 7 * 24 * 60 * 60 * 1000;
export const CFB_WEEKS = 15; // adjust if you like

export function seasonStart(year = new Date().getUTCFullYear()) {
  // Roughly Week 0/1 window
  return new Date(Date.UTC(year, 7, 26, 0, 0, 0)); // Aug 26 UTC
}

export function getCfbWeekRange(week: number, year?: number) {
  const safe = Math.max(1, Math.min(CFB_WEEKS, Math.floor(week)));
  const start = seasonStart(year);
  const from = new Date(start.getTime() + (safe - 1) * MS7);
  const to = new Date(from.getTime() + MS7);
  return { from, to };
}

export function getCurrentCfbWeek(today = new Date()) {
  const start = seasonStart(today.getUTCFullYear());
  const diff = Math.floor((today.getTime() - start.getTime()) / MS7) + 1;
  return Math.max(1, Math.min(CFB_WEEKS, diff));
}
