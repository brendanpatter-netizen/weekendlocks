// lib/weekLabel.ts
// weeks.week_num is 1-based internally (matches the DB's natural key and
// every join/lookup) and, for NFL, already matches the real NFL week shown
// to players — week_num=1 is NFL Week 1. CFB is the one with an offset:
// its week_num=1 is the sport's real "Week 0" slate (games the last week of
// August), week_num=2 is real "Week 1", and so on, so CFB display numbers
// are one lower than week_num. Every user-facing "Week N" / "Wk N" string
// should route through this rather than assuming either convention.
export function displayWeek(weekNum: number, league: "nfl" | "cfb"): number {
  return league === "cfb" ? weekNum - 1 : weekNum;
}
