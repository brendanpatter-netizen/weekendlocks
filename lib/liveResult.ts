// lib/liveResult.ts
// Mirrors the CASE logic in public.pick_results (see
// supabase/migrations/2026-08-10i_grading_and_records.sql) exactly, but
// evaluated client-side against whatever score is on the game right now —
// final or still live. That's the whole point of the Live Board: showing
// "winning/losing right now," not waiting for the once-a-day grading sweep.
// The two are guaranteed to agree once a game goes final, since it's the
// same formula run against the same eventual score.
export type LiveResult = "winning" | "losing" | "push" | null;

export type LiveResultPick = { market: string | null; side: string | null; line: string | null };
export type LiveResultGame = { home_score: number | null; away_score: number | null };

export function computeLiveResult(pick: LiveResultPick, game: LiveResultGame): LiveResult {
  if (game.home_score == null || game.away_score == null) return null;
  const line = pick.line != null ? Number(pick.line) : 0;
  const { home_score, away_score } = game;

  if (pick.market === "spreads" && pick.side === "home") {
    const adj = home_score + line;
    return adj > away_score ? "winning" : adj === away_score ? "push" : "losing";
  }
  if (pick.market === "spreads" && pick.side === "away") {
    const adj = away_score + line;
    return adj > home_score ? "winning" : adj === home_score ? "push" : "losing";
  }
  if (pick.market === "totals" && pick.side === "over") {
    const total = home_score + away_score;
    return total > line ? "winning" : total === line ? "push" : "losing";
  }
  if (pick.market === "totals" && pick.side === "under") {
    const total = home_score + away_score;
    return total < line ? "winning" : total === line ? "push" : "losing";
  }
  if (pick.market === "h2h" && pick.side === "home") {
    return home_score > away_score ? "winning" : home_score === away_score ? "push" : "losing";
  }
  if (pick.market === "h2h" && pick.side === "away") {
    return away_score > home_score ? "winning" : away_score === home_score ? "push" : "losing";
  }
  return null;
}
