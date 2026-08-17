// lib/weekLabel.ts
// weeks.week_num is 1-based internally (matches the DB's natural key and
// every join/lookup), but the number shown to players is one lower — CFB's
// week_num=1 is the sport's real "Week 0" slate, week_num=2 is real "Week 1",
// and so on. Every user-facing "Week N" / "Wk N" string should route through
// this so the numbering stays consistent across the picks pages, group
// dashboard, and season grid.
export function displayWeek(weekNum: number): number {
  return weekNum - 1;
}
