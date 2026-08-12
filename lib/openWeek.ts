// lib/openWeek.ts
// The single source of truth for "which week is live right now" — driven
// by weeks.opens_at/closes_at rather than client-side date math, so NFL
// and CFB (which open/close on different real-world dates) can each have
// their own live week, and picks are only makeable during that window.
import { supabase } from "@/lib/supabase";

export type OpenWeek = { week: number; opensAt: string; closesAt: string };

export async function getOpenWeek(league: "nfl" | "cfb"): Promise<OpenWeek | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("weeks")
    .select("week_num, opens_at, closes_at")
    .eq("league", league)
    .lte("opens_at", nowIso)
    .gt("closes_at", nowIso)
    .order("opens_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { week: data.week_num, opensAt: data.opens_at, closesAt: data.closes_at };
}
