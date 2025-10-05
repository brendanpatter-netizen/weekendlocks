// lib/stats.ts
import { supabase } from "@/lib/supabase";

export type WeeklyResult = { week: number; wins: number; losses: number };

/**
 * Simple volume chart: number of picks made per week for a group/league.
 * Returns [{ week, wins, losses }] where `wins` temporarily holds the count.
 */
export async function getWeeklyPickCountsForGroup({
  groupId,
  sport,
  fromWeek = 1,
  toWeek,
}: {
  groupId: string;
  sport: "nfl" | "cfb";
  fromWeek?: number;
  toWeek?: number;
}): Promise<WeeklyResult[]> {
  const { data, error } = await supabase
    .from("picks")
    .select("week")
    .eq("group_id", groupId)
    .eq("sport", sport);

  if (error) throw error;

  const counts = new Map<number, number>();
  let maxWeek = 0;

  for (const r of data ?? []) {
    const w = Number(r.week);
    if (!Number.isFinite(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
    if (w > maxWeek) maxWeek = w;
  }

  const hi = toWeek ?? maxWeek;
  const out: WeeklyResult[] = [];
  for (let w = fromWeek; w <= hi; w++) {
    const n = counts.get(w) ?? 0;
    out.push({ week: w, wins: n, losses: 0 }); // temp: all in “wins” bar
  }
  return out;
}
