// lib/gameClock.ts
// Quarter/clock for a live game — the Odds API's /scores endpoint (used for
// win/loss coloring) doesn't carry this at all, so it comes from ESPN's
// public scoreboard endpoint instead: a second, free, uncredited source
// that sits next to the Odds API rather than replacing it. That endpoint is
// unofficial (the same one espn.com's own scoreboard calls, not a published
// product), so every call here is expected to fail silently — no API key,
// no contract on the response shape, no notice if it ever changes or gets
// rate-limited. A failure should just mean "no clock shown," never a crash.
import { matchupsLikelyMatch } from "@/lib/teamMatch";

export type GameClock = { home: string; away: string; state: "pre" | "in" | "post"; label: string };

const ESPN_SPORT_PATH: Record<"nfl" | "cfb", string> = {
  nfl: "football/nfl",
  cfb: "football/college-football",
};

export async function fetchGameClocks(league: "nfl" | "cfb"): Promise<GameClock[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_SPORT_PATH[league]}/scoreboard`);
  if (!res.ok) throw new Error(`ESPN scoreboard fetch failed (${res.status})`);
  const data = await res.json();
  const events: any[] = data.events ?? [];

  return events
    .map((e) => {
      const comp = e.competitions?.[0];
      const status = comp?.status;
      const home = comp?.competitors?.find((c: any) => c.homeAway === "home")?.team?.displayName ?? "";
      const away = comp?.competitors?.find((c: any) => c.homeAway === "away")?.team?.displayName ?? "";
      return {
        home,
        away,
        state: (status?.type?.state ?? "pre") as GameClock["state"],
        label: status?.type?.shortDetail ?? "",
      };
    })
    .filter((g) => g.home && g.away);
}

export function findGameClock(
  clocks: GameClock[], home: string, away: string, league: "nfl" | "cfb"
): GameClock | null {
  return clocks.find((c) => matchupsLikelyMatch(home, away, c.home, c.away, league)) ?? null;
}
