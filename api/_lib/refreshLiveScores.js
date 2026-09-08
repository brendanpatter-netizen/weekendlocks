// api/_lib/refreshLiveScores.js
// Client-triggered (not cron — see api/live-scores.js) live score refresh
// for the group Live Board. Vercel Hobby caps cron at once a day, so
// there's no fixed schedule to hang this off; instead the Live Board page
// pings this while someone actually has it open, which is also strictly
// cheaper than blind interval polling — nobody watching means nothing
// spent, and the debounce below caps cost per league regardless of how
// many people are watching at once.
const { matchupsLikelyMatch } = require("./refreshScores");

// Matches api/_lib/refreshScores.js's own daysFrom=3 cutoff reasoning, but
// here it's "how far back could a still-not-final game have kicked off" —
// generous enough to cover overtime/weather delays without pretending a
// 2-day-old game could still be live.
const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
// The Odds API's own live scores only update server-side every ~30s
// (per their docs) — polling faster than this debounce buys nothing and
// only spends credits, so it doubles as the effective global poll rate no
// matter how often clients ping or how many are watching at once.
const DEBOUNCE_MS = 25 * 1000;

async function refreshLiveScores(supabase, league) {
  // Atomic claim: this UPDATE only matches (and only one concurrent caller's
  // UPDATE wins) if the row's last_polled_at is older than the debounce
  // window — everyone else's ping this window is a free no-op.
  const cutoffIso = new Date(Date.now() - DEBOUNCE_MS).toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from("live_poll_state")
    .update({ last_polled_at: new Date().toISOString() })
    .eq("league", league)
    .lt("last_polled_at", cutoffIso)
    .select();
  if (claimErr) return { polled: false, updated: 0, reason: `claim failed: ${claimErr.message}` };
  if (!claimed || claimed.length === 0) return { polled: false, updated: 0, reason: "debounced" };

  const nowIso = new Date().toISOString();
  const windowStartIso = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
  const { data: pending } = await supabase
    .from("games")
    .select("id, home, away, kickoff_at, weeks!inner(league)")
    .eq("weeks.league", league)
    .neq("status", "final")
    .lte("kickoff_at", nowIso)
    .gte("kickoff_at", windowStartIso);
  if (!pending || pending.length === 0) return { polled: false, updated: 0, reason: "nothing live" };

  const oddsSportKey = league === "nfl" ? "americanfootball_nfl" : "americanfootball_ncaaf";
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return { polled: false, updated: 0, error: "Missing ODDS_API_KEY" };

  // No daysFrom: 1 credit instead of 2, and returns live/in-progress scores
  // (daysFrom only adds already-completed games from up to 3 days back,
  // which is what the once-a-day final-grading sweep is for).
  const url = `https://api.the-odds-api.com/v4/sports/${oddsSportKey}/scores/?apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return { polled: true, updated: 0, error: `Scores fetch failed (${res.status})` };
  const results = await res.json();

  let updated = 0;
  for (const g of pending) {
    const center = new Date(g.kickoff_at).getTime();
    const match = results.find((r) => {
      const withinWindow = Math.abs(new Date(r.commence_time).getTime() - center) < 48 * 60 * 60 * 1000;
      return withinWindow && r.scores?.length && matchupsLikelyMatch(g.home, g.away, r.home_team, r.away_team, league);
    });
    if (!match) continue;
    const homeEntry = match.scores.find((s) => s.name === match.home_team);
    const awayEntry = match.scores.find((s) => s.name === match.away_team);
    const home_score = homeEntry ? Number(homeEntry.score) : NaN;
    const away_score = awayEntry ? Number(awayEntry.score) : NaN;
    if (!Number.isFinite(home_score) || !Number.isFinite(away_score)) continue;

    // Already-completed by the time we caught it: finalize it directly
    // rather than marking it merely "live" and waiting for the once-a-day
    // sweep to grade it — nice side effect of polling live is picks color
    // in almost the moment the game ends, not up to a day later.
    const rpc = match.completed ? "record_game_score" : "record_live_score";
    const { error } = await supabase.rpc(rpc, {
      _game_id: g.id, _home_score: home_score, _away_score: away_score,
    });
    if (!error) updated++;
  }
  return { polled: true, updated };
}

module.exports = { refreshLiveScores };
