// api/_lib/refreshScores.js
// Shared by both api/generate-weekly-recaps.js and api/refresh-scores.js —
// pulled out so the two cron jobs don't carry two copies of the same
// grading logic. Plain CommonJS/.js (not .ts): this can't import
// lib/teamMatch.ts or lib/scores.ts directly, since lib/supabase.ts (and
// much of lib/) pulls in react-native, which doesn't load outside the
// Expo/Metro runtime. Mirrors lib/scores.ts's real-mode branch (there's no
// mock mode server-side).

// --- team name matching (copied from lib/teamMatch.ts) ---
function normTeam(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, "and")
    .replace(/\s+st\./g, " state")
    .replace(/[\s-]+/g, " ")
    .trim();
}
const NFL_ALIASES = {
  "ny giants": "new york giants", giants: "new york giants",
  "ny jets": "new york jets", jets: "new york jets",
  "la rams": "los angeles rams", rams: "los angeles rams",
  "la chargers": "los angeles chargers", chargers: "los angeles chargers",
  jax: "jacksonville jaguars", bucs: "tampa bay buccaneers",
  "no saints": "new orleans saints", "ne patriots": "new england patriots",
  "gb packers": "green bay packers", "kc chiefs": "kansas city chiefs",
  "lv raiders": "las vegas raiders", "ari cardinals": "arizona cardinals",
  "sf 49ers": "san francisco 49ers", "sea seahawks": "seattle seahawks",
  tb: "tampa bay buccaneers", wsh: "washington commanders",
};
function aliasNFL(name) { return NFL_ALIASES[normTeam(name)] ?? normTeam(name); }
function normFor(name, league) { return league === "nfl" ? aliasNFL(name) : normTeam(name); }
function teamsLikelyMatch(a, b, league) {
  const na = normFor(a, league);
  const nb = normFor(b, league);
  return na.includes(nb) || nb.includes(na);
}
function matchupsLikelyMatch(rHome, rAway, feedHome, feedAway, league) {
  const dir = teamsLikelyMatch(rHome, feedHome, league) && teamsLikelyMatch(rAway, feedAway, league);
  const swap = teamsLikelyMatch(rHome, feedAway, league) && teamsLikelyMatch(rAway, feedHome, league);
  return dir || swap;
}

// --- score grading ---
async function refreshScores(supabase, league) {
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: pending } = await supabase
    .from("games")
    .select("id, home, away, kickoff_at, status, weeks!inner(league)")
    .eq("weeks.league", league)
    .neq("status", "final")
    .lt("kickoff_at", cutoff);
  if (!pending || pending.length === 0) return { updated: 0 };

  const oddsSportKey = league === "nfl" ? "americanfootball_nfl" : "americanfootball_ncaaf";
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return { updated: 0, error: "Missing ODDS_API_KEY" };

  const url = `https://api.the-odds-api.com/v4/sports/${oddsSportKey}/scores/?apiKey=${apiKey}&daysFrom=3`;
  const res = await fetch(url);
  if (!res.ok) return { updated: 0, error: `Scores fetch failed (${res.status})` };
  const results = await res.json();
  const completed = results.filter((r) => r.completed && r.scores?.length);

  let updated = 0;
  for (const g of pending) {
    const center = new Date(g.kickoff_at).getTime();
    const match = completed.find((r) => {
      const withinWindow = Math.abs(new Date(r.commence_time).getTime() - center) < 48 * 60 * 60 * 1000;
      return withinWindow && matchupsLikelyMatch(g.home, g.away, r.home_team, r.away_team, league);
    });
    if (!match || !match.scores) continue;
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

module.exports = { refreshScores, matchupsLikelyMatch };
