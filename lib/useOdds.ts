// lib/useOdds.ts
import { useEffect, useRef, useState } from "react";
import { getWeekRange as getNflWeekRange } from "./nflWeeks";
import { getCfbWeekRange } from "./cfbWeeks";

/** Types that loosely match The Odds API */
export type Outcome = { name: string; price?: number; point?: number };
export type MarketKey = "spreads" | "h2h" | "totals" | string;
export type Market = { key: MarketKey; outcomes: Outcome[] };
export type Bookmaker = { key: string; last_update: string; markets: Market[] };
export type Game = {
  id: string;
  commence_time: string; // ISO
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
};

type UseOddsOpts = {
  /** e.g. ["spreads","totals","h2h"] */
  markets?: MarketKey[];
  /** e.g. "us","us2" (see Odds API docs) */
  region?: string;
  /** "american" | "decimal" | "fractional" */
  oddsFormat?: "american" | "decimal" | "fractional";
  /** polling interval (ms). 0/undefined disables polling */
  pollMs?: number;
};

/** Simple date util: always return ISO strings for a week window */
function getIsoWindow(
  sportKey: string,
  week: number
): { start?: string; end?: string } {
  try {
    if (sportKey.includes("nfl")) {
      const { start, end } = getNflWeekRange(week); // returns Date objects in our latest helper
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (sportKey.includes("ncaaf") || sportKey.includes("cfb")) {
      const { start, end } = getCfbWeekRange(week); // returns Date objects
      return { start: start.toISOString(), end: end.toISOString() };
    }
  } catch {
    // fall through – no window
  }
  return {}; // no filter applied
}

export function useOdds(
  sport: string,
  week: number,
  {
    markets = ["spreads", "totals", "h2h"],
    region = "us",
    oddsFormat = "american",
    pollMs,
  }: UseOddsOpts = {}
) {
  const [data, setData] = useState<Game[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchOdds(signal?: AbortSignal) {
    setError(null);

    // normalize week → ISO strings (no .getTime() anywhere)
    const window = getIsoWindow(sport, Number(week));
    const apiKey =
      process.env.NEXT_PUBLIC_ODDS_API_KEY ||
      process.env.EXPO_PUBLIC_ODDS_API_KEY ||
      process.env.ODDS_API_KEY;

    if (!apiKey) {
      setError(new Error("Missing ODDS_API_KEY / NEXT_PUBLIC_ODDS_API_KEY"));
      return;
    }

    try {
      setLoading(true);

      const params = new URLSearchParams({
        apiKey,
        regions: region,
        markets: markets.join(","),
        oddsFormat,
        dateFormat: "iso",
      });
      // Odds API doesn’t support direct date filtering on this endpoint.
      // We’ll fetch and then filter by commence_time inside the week window (if provided).
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?${params.toString()}`;

      const res = await fetch(url, { signal });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Odds fetch failed (${res.status}): ${text}`);
      }
      const raw: Game[] = await res.json();

      let filtered = raw;
      if (window.start && window.end) {
        const startMs = Date.parse(window.start);
        const endMs = Date.parse(window.end);
        filtered = raw.filter((g) => {
          const t = Date.parse(g.commence_time);
          return t >= startMs && t < endMs;
        });
      }

      setData(filtered);
      setLastUpdated(Date.now());
      setLoading(false);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e instanceof Error ? e : new Error(String(e)));
      setLoading(false);
    }
  }

  useEffect(() => {
    // fresh controller each run
    const controller = new AbortController();
    abortRef.current = controller;
    fetchOdds(controller.signal);

    if (timerRef.current) clearInterval(timerRef.current);
    if (pollMs && pollMs > 0) {
      timerRef.current = setInterval(() => {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        fetchOdds(ctrl.signal);
      }, pollMs);
    }

    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, week, region, oddsFormat, pollMs, markets.join(",")]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh: () => fetchOdds(),
  };
}
