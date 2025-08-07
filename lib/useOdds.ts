// lib/useOdds.ts
import { useEffect, useState } from 'react';

export type Game = {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: {
    title: string;
    markets: {
      key: string;                  // spreads, totals, h2h, …
      outcomes: { name: string; price: number; point?: number }[];
    }[];
  }[];
};

export function useOdds(sport = 'americanfootball_nfl') {
  const [data, setData] = useState<Game[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchOdds = async () => {
      try {
        const key = process.env.EXPO_PUBLIC_ODDS_API_KEY;
        if (!key) throw new Error('Missing EXPO_PUBLIC_ODDS_API_KEY');

        const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${key}&regions=us&markets=spreads,totals&oddsFormat=american`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);

        const json = (await res.json()) as Game[];
        if (mounted) setData(json);
      } catch (e) {
        if (mounted) setError(e as Error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOdds();
    const id = setInterval(fetchOdds, 60_000); // refresh every 60 s
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [sport]);

  return { data, error, loading };
}
