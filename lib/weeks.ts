// lib/weeks.ts
export type WeekRange = { week: number; start: string; end: string }; // ISO strings **with Z**

import { nflWeeks } from "./nflWeeks";  // ensure start/end are ISO with 'Z'
import { cfbWeeks } from "./cfbWeeks";  // ensure start/end are ISO with 'Z'

function findWeek(weeks: WeekRange[], at = new Date()): number {
  // compare in UTC by parsing ISO with Z
  const t = at.getTime();
  for (const w of weeks) {
    const s = Date.parse(w.start); // must include 'Z'
    const e = Date.parse(w.end);   // exclusive end
    if (t >= s && t < e) return w.week;
  }
  // If we're before first range, clamp to 1; if after last, clamp to last
  if (t < Date.parse(weeks[0].start)) return weeks[0].week;
  return weeks[weeks.length - 1].week;
}

export function getCurrentWeekNFL(at?: Date) {
  return findWeek(nflWeeks, at);
}
export function getCurrentWeekCFB(at?: Date) {
  return findWeek(cfbWeeks, at);
}
