// lib/useOdds.ts
import { useEffect, useState } from 'react';
import { getWeekRange } from './nflWeeks';

/* ────────────────────────────────
   Type helpers
   ──────────────────────────────── */
export type Outcome = {
  name: string;      // "Detroit Lions"
  price: number;     // -110
  point?: number;    // -3.5 (spread) or 48.5 (total)
};

export type Market = {
  key: string;       // "spreads" | "totals" | "h2h" | …
  outcomes: Outcome[];
};

export type Bookmaker = {
  title: string;     // "DraftKings"
  markets: Market[];
};

export type Game = {
  id: string;
  sport_key: string; // "americanfootball_nfl"
  commence_time: string; // ISO date/time
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
};

/* ────────────────────────────────
   Main hook
   ──────────────────────────────── */
/**
 * Fetch odds from The Odds API and (optionally) filter by NFL week.
 * @param sport default "americanfootball_nfl"
 * @param week  1-18 to filter by kickoff week; omit for all weeks
 */
export function useOdds(
  sport: string = 'americanfootball_nfl',
  week?: number
) {
  const [data,    setData]    = useState<Game[] | null>(null);
  const [error,   setError]   = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const fetchOdds = async () => {
      try {
        /* 1. Read key (must be public-prefixed for browser bundle) */
        const key = process.env.EXPO_PUBLIC_ODDS_API_KEY;
        if (!key) throw new Error('Missing EXPO_PUBLIC_ODDS_API_KEY');

        /* 2. Call the API */
        const url =
          `https://api.the-odds-api.com/v4/sports/${sport}/odds` +
          `?apiKey=${key}&regions=us&markets=spreads,totals&oddsFormat=american`;

        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API ${res.status}: ${text}`);
        }

        /* 3. Parse + (optionally) week-filter */
        let games: Game[] = await res.json();

        if (week) {
          const { start, end } = getWeekRange(week);
          games = games.filter(g => {
            const t = new Date(g.commence_time).getTime();
            return t >= start.getTime() && t < end.getTime();
          });
        }

        if (mounted) {
          setData(games);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err as Error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    /* initial + auto-refresh every 60 s */
    fetchOdds();
    const id = setInterval(fetchOdds, 60_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [sport, week]); // rerun whenever sport or week changes

  return { data, error, loading };
}
