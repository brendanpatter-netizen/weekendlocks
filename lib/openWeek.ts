// lib/openWeek.ts
// The single source of truth for "which week is live right now" — driven
// by weeks.opens_at/closes_at rather than client-side date math, so NFL
// and CFB (which open/close on different real-world dates) can each have
// their own live week, and picks are only makeable during that window.
import { supabase } from "@/lib/supabase";

export type OpenWeek = { week: number; opensAt: string; closesAt: string };

export async function getOpenWeek(league: "nfl" | "cfb"): Promise<OpenWeek | null> {
  const nowIso = new Date().toISOString();
  // Correct data has at most one week matching this window at a time, so
  // ordering direction is normally moot — but a week row occasionally gets
  // corrupted by something outside this codebase with a bogus "opens
  // today" timestamp (see the 2026-09-21 migration, the third time this
  // has hit a different row), which briefly makes two weeks match at once.
  // Preferring the EARLIEST-opening match means a legitimately-still-open
  // week (open for days already) wins over a newly-appeared bogus one,
  // rather than the reverse.
  const { data, error } = await supabase
    .from("weeks")
    .select("week_num, opens_at, closes_at")
    .eq("league", league)
    .lte("opens_at", nowIso)
    .gt("closes_at", nowIso)
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { week: data.week_num, opensAt: data.opens_at, closesAt: data.closes_at };
}

// For when nothing's live right now — lets the UI say "opens Sep 8" instead
// of just a dead-end "not live."
export async function getNextWeek(league: "nfl" | "cfb"): Promise<OpenWeek | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("weeks")
    .select("week_num, opens_at, closes_at")
    .eq("league", league)
    .gt("opens_at", nowIso)
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { week: data.week_num, opensAt: data.opens_at, closesAt: data.closes_at };
}

// Like getOpenWeek, but tolerates a week whose closes_at already passed —
// used by the Live Board, which wants to keep showing a league's locks for
// the whole real calendar week (through the last game, whichever league it
// belongs to) rather than dropping that league the instant its own
// closes_at ticks over. NFL and CFB are seeded to close at the same real
// moment, but a bad week row (see the 2026-09-16 migration — one auto-
// created outside the normal seed got a closes_at hours-to-days early) can
// desync that; this grace window keeps a glitch like that from silently
// hiding a league's picks instead of just showing them a little longer
// than strictly necessary.
const OPEN_WEEK_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
export async function getOpenOrRecentWeek(league: "nfl" | "cfb"): Promise<OpenWeek | null> {
  const open = await getOpenWeek(league);
  if (open) return open;

  const nowIso = new Date().toISOString();
  const graceStartIso = new Date(Date.now() - OPEN_WEEK_GRACE_MS).toISOString();
  const { data, error } = await supabase
    .from("weeks")
    .select("week_num, opens_at, closes_at")
    .eq("league", league)
    .lt("closes_at", nowIso)
    .gt("closes_at", graceStartIso)
    .order("closes_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { week: data.week_num, opensAt: data.opens_at, closesAt: data.closes_at };
}
