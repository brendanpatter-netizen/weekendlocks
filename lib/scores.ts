// lib/scores.ts
import { supabase } from "./supabase";
import { matchupsLikelyMatch } from "./teamMatch";

const ODDS_MOCK =
  process.env.EXPO_PUBLIC_ODDS_MOCK === "true" || process.env.EXPO_PUBLIC_ODDS_MOCK === "1";

type PendingGame = { id: number; home: string; away: string; kickoff_at: string };

function seeded(seed: number): number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return ((s * 16807) % 2147483647) / 2147483647;
}
function mockScore(gameId: number, salt: number): number {
  return 10 + Math.floor(seeded(gameId * 97 + salt) * 28); // 10..37
}

async function fetchPendingGames(league: "nfl" | "cfb", onlyPast: boolean): Promise<PendingGame[]> {
  let query = supabase
    .from("games")
    .select("id, home, away, kickoff_at, status, weeks!inner(league)")
    .eq("weeks.league", league)
    .neq("status", "final");

  if (onlyPast) {
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // games are usually decided ~3h after kickoff
    query = query.lt("kickoff_at", cutoff);
  }

  const { data } = await query;
  return (data ?? []) as PendingGame[];
}

/**
 * Fills in final scores for games that don't have them yet, then marks them
 * final via record_game_score (a SECURITY DEFINER RPC — no broad UPDATE
 * grant needed on games). In mock mode this fabricates deterministic scores
 * instead of calling the real Odds API, so grading can be tested for free
 * before the season starts.
 */
export async function refreshScoresForSport(sport: "nfl" | "cfb"): Promise<{ updated: number; error?: string }> {
  const pending = await fetchPendingGames(sport, !ODDS_MOCK);
  if (pending.length === 0) return { updated: 0 };

  if (ODDS_MOCK) {
    let updated = 0;
    for (const g of pending) {
      const home_score = mockScore(g.id, 1);
      const away_score = mockScore(g.id, 2);
      const { error } = await supabase.rpc("record_game_score", {
        _game_id: g.id, _home_score: home_score, _away_score: away_score,
      });
      if (!error) updated++;
    }
    return { updated };
  }

  const oddsSportKey = sport === "nfl" ? "americanfootball_nfl" : "americanfootball_ncaaf";
  const apiKey =
    process.env.NEXT_PUBLIC_ODDS_API_KEY ||
    process.env.EXPO_PUBLIC_ODDS_API_KEY ||
    process.env.ODDS_API_KEY;
  if (!apiKey) return { updated: 0, error: "Missing ODDS_API_KEY" };

  const url = `https://api.the-odds-api.com/v4/sports/${oddsSportKey}/scores/?apiKey=${apiKey}&daysFrom=3`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    return { updated: 0, error: `Scores fetch failed (${res.status}): ${text}` };
  }
  const results: Array<{
    home_team: string; away_team: string; commence_time: string; completed: boolean;
    scores?: Array<{ name: string; score: string }> | null;
  }> = await res.json();

  const completed = results.filter((r) => r.completed && r.scores?.length);

  let updated = 0;
  for (const g of pending) {
    const center = new Date(g.kickoff_at).getTime();
    const match = completed.find((r) => {
      const withinWindow = Math.abs(new Date(r.commence_time).getTime() - center) < 48 * 60 * 60 * 1000;
      return withinWindow && matchupsLikelyMatch(g.home, g.away, r.home_team, r.away_team, sport);
    });
    if (!match || !match.scores) continue;

    // scores[].name values come from the same API response as home_team/away_team, so this is an exact match, not fuzzy.
    const homeEntry = match.scores.find((s) => s.name === match.home_team);
    const awayEntry = match.scores.find((s) => s.name === match.away_team);
    const home_score = homeEntry ? Number(homeEntry.score) : NaN;
    const away_score = awayEntry ? Number(awayEntry.score) : NaN;
    if (!Number.isFinite(home_score) || !Number.isFinite(away_score)) continue;

    const { error } = await supabase.rpc("record_game_score", {
      _game_id: g.id, _home_score: home_score, _away_score: away_score,
    });
    if (!error) updated++;
  }

  return { updated };
}
