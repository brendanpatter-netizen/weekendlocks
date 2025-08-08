// lib/cfbWeeks.ts
// Super simple “one week = 7 days” model starting late August.
// Tweak SEASON_START if needed each season.

const MS7 = 7 * 24 * 60 * 60 * 1000; // 7 days
export const CFB_WEEKS = 15; // regular season + conf champs (adjust if you want)

export function seasonStart(year = new Date().getUTCFullYear()) {
  // Approx: Aug 26 UTC (week 0/1 window). Adjust if you want exact schedule.
  return new Date(Date.UTC(year, 7, 26, 0, 0, 0));
}

export function getCfbWeekRange(week: number, year?: number) {
  if (week < 1) week = 1;
  if (week > CFB_WEEKS) week = CFB_WEEKS;

  const start = seasonStart(year);
  const from = new Date(start.getTime() + (week - 1) * MS7);
  const to   = new Date(from.getTime() + MS7);
  return { from, to };
}

export function getCurrentCfbWeek(today = new Date()) {
  const start = seasonStart(today.getUTCFullYear());
  const diff  = Math.floor((today.getTime() - start.getTime()) / MS7) + 1;
  return Math.max(1, Math.min(CFB_WEEKS, diff));
}
