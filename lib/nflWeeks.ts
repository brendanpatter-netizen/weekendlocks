// lib/nflWeeks.ts
// ↻  Update SEASON_START each season
export const SEASON_START = new Date('2025-09-04T00:00:00Z'); // Week 1 kickoff

const MS_DAY = 86_400_000;

export function getWeekRange(week: number) {
  const start = new Date(SEASON_START.getTime() + (week - 1) * 7 * MS_DAY);
  const end   = new Date(start.getTime() + 7 * MS_DAY);
  return { start, end };
}

export function getCurrentWeek(today = new Date()) {
  const diff = today.getTime() - SEASON_START.getTime();
  if (diff < 0) return 0;                      // pre-season
  return Math.floor(diff / (7 * MS_DAY)) + 1;  // 1-based
}
