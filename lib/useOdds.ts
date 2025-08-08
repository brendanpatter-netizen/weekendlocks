// lib/useOdds.ts
import { useEffect, useRef, useState } from 'react';
import { getWeekRange as getNflWeekRange } from './nflWeeks'; // returns { start,end } in your project
import { getCfbWeekRange } from './cfbWeeks';                 // ours returns { from,to } (or we normalize below)

export type Outcome = { name: string; price?: number; point?: number };
export type MarketKey = 'spreads' | 'h2h' | 'totals' | string;
export type Market = { key: MarketKey; outcomes: Outcome[] };
export type Bookmaker = { key: string; last_update: string; markets: Market[] };
export type Game = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
};

type UseOddsOpts = {
  markets?: MarketKey[];
  region?: 'us' | 'us2' | 'eu' | 'uk' | 'au';
  oddsFormat?: 'american' | 'decimal';
  pollMs?: number;
  fetchOnce?: boolean;
};

export function useOdds(sport: string, week?: number, opts: UseOddsOpts = {}) {
  const {
    markets = ['spreads', 'h2h', 'totals'],
    region = 'us',
    oddsFormat = 'american',
    pollMs = 60000,
    fetchOnce = false,
  } = opts;

  const [data, setData] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiKey =
    process.env.EXPO_PUBLIC_ODDS_API_KEY ?? process.env.ODDS_API_KEY;

  const fetchOdds = async (signal?: AbortSignal) => {
    if (!apiKey) {
      setError(new Error('Missing ODDS_API_KEY / EXPO_PUBLIC_ODDS_API_KEY'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        apiKey,
        regions: region,
        markets: markets.join(','),
        oddsFormat,
        dateFormat: 'iso',
      });
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?${params.toString()}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Odds API ${res.status}: ${await res.text()}`);

      const json: Game[] = await res.json();

      // 🔁 Normalize week range shape: support {from,to} OR {start,end}
      let from: Date | undefined;
      let to: Date | undefined;

      if (week && Number.isFinite(week)) {
        let r: any;
        if (sport.includes('nfl')) {
          r = getNflWeekRange(Number(week)); // your function likely returns {start,end}
        } else if (sport.includes('ncaaf')) {
          r = getCfbWeekRange(Number(week)); // ours returns {from,to}
        }
        if (r) {
          from = r.from ?? r.start;
          to   = r.to   ?? r.end;
        }
      }

      const filtered =
        from && to
          ? json.filter((g) => {
              const t = new Date(g.commence_time).getTime();
              return t >= from.getTime() && t < to.getTime();
            })
          : json;

      setData(filtered);
      setError(undefined);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchOdds(controller.signal);

    if (!fetchOnce && pollMs > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const ctrl = new AbortController();
        fetchOdds(ctrl.signal);
      }, pollMs);
    }

    return () => {
      controller.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, week, region, oddsFormat, pollMs, markets.join(',')]);

  return { data, loading, error, lastUpdated, refresh: () => fetchOdds() };
}
