import { useEffect, useState } from 'react';

type Odds = {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  bookmakers: unknown[];
};

export function useOdds(sport = 'americanfootball_nfl') {
  const [data, setData] = useState<Odds[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchOdds = async () => {
      try {
        const key = process.env.ODDS_API_KEY;
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${key}&regions=us&markets=spreads,totals&oddsFormat=american`
        );
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = (await res.json()) as Odds[];
        if (mounted) setData(json);
      } catch (err) {
        if (mounted) setError(err as Error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchOdds();
    // optional polling every 60 s:
    const id = setInterval(fetchOdds, 60000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [sport]);

  return { data, error, loading };
}
