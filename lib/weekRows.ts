// lib/weekRows.ts
// Shared "real calendar week" row sequence — originally lived only in
// WeeklyPicksGrid, now also used by Bankroll, so both season-long trackers
// line up on the same row for the same real week.
//
// NFL and CFB number their own weeks independently — CFB starts about two
// weeks earlier with its own "Week 0" slate, so week_num=1 for one sport
// isn't the same real week as week_num=1 for the other. The only thing
// that actually identifies "the same real week" across both sports is a
// shared kickoff window, so rows are built from each league's own
// weeks.opens_at rather than from week_num directly: every distinct
// opens_at across both leagues gets one row, and a week from either sport
// lands in the row whose date it shares.
//
// Grouped by proximity rather than exact equality: a week row can get
// auto-created or externally corrupted with an opens_at a few hours or
// days off the aligned boundary the other league uses for the same real
// week (see the 2026-09-16 and 2026-10-04 migrations). Exact-match
// grouping would silently split that week into its own row instead of
// merging it; two real distinct weeks are always ~7 days apart, so a
// tolerance well under that only ever absorbs that kind of drift, never
// merges genuinely different weeks.
const ROW_GROUP_TOLERANCE_MS = 3 * 24 * 60 * 60 * 1000;

export function buildWeekRows(weeksData: { league: string; week_num: number; opens_at: string }[]) {
  const sortedOpensAt = Array.from(new Set(weeksData.map((w) => w.opens_at))).sort();
  const rowForOpensAt = new Map<string, number>();
  let rowIndex = -1;
  let rowAnchorMs = -Infinity;
  for (const d of sortedOpensAt) {
    const t = new Date(d).getTime();
    if (t - rowAnchorMs > ROW_GROUP_TOLERANCE_MS) {
      rowIndex++;
      rowAnchorMs = t;
    }
    rowForOpensAt.set(d, rowIndex);
  }
  const rowForWeekNum = new Map<string, number>(); // key: `${league}|${week_num}`
  weeksData.forEach((w) => {
    const row = rowForOpensAt.get(w.opens_at);
    if (row != null) rowForWeekNum.set(`${w.league}|${w.week_num}`, row);
  });
  return { rowCount: rowIndex + 1, rowForWeekNum };
}

// Shared "which season is this group's picks data in" derivation — the
// weeks table holds every season this app has ever seeded (2025 test data
// included), so merging opens_at across seasons would scatter rows across
// a year of unrelated dates. Derive the season from the real games a
// group's picks reference; fall back to the current calendar year for a
// brand-new group with no picks yet.
export function deriveSeason(pickWeeksRows: { season: number }[]): number {
  const seasons = Array.from(new Set(pickWeeksRows.map((w) => w.season)));
  return seasons.length ? Math.max(...seasons) : new Date().getFullYear();
}
