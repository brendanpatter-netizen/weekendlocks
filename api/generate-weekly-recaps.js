// api/generate-weekly-recaps.js
// Vercel Cron hits this every Tuesday morning (see vercel.json's `crons`).
// Also directly requireable (see module.exports.runWeeklyRecapJob) for
// local testing via scripts/test-generate-recaps.cjs.
//
// For each group: refreshes final scores for both leagues (same approach
// as lib/scores.ts's refreshScoresForSport, but using a service-role
// Supabase client instead of a signed-in user's -- record_game_score's
// auth check was widened to also accept service_role in migration
// 2026-08-14b), then builds each member's this-week picks + overall
// record + current streak, and asks Claude for one savage-roast recap per
// member. Recaps are upserted into weekly_recaps keyed by
// (group_id, user_id, week_of), so re-running the same week overwrites
// rather than duplicates.
//
// Plain CommonJS/.js (not .ts) and the team-name-matching helpers below are
// a deliberate copy of lib/teamMatch.ts's logic: this file can't import
// that module directly because lib/supabase.ts (and much of lib/) pulls in
// react-native, which doesn't load outside the Expo/Metro runtime.

const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk");

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

// --- score grading (mirrors lib/scores.ts's real-mode branch; this job
// always uses real odds, there's no mock mode server-side) ---
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

// The most recently completed week for a league, independent of the other
// league's numbering (NFL and CFB each run their own week_num counter).
async function mostRecentClosedWeek(supabase, league) {
  const { data } = await supabase
    .from("weeks")
    .select("week_num, season, closes_at")
    .eq("league", league)
    .lte("closes_at", new Date().toISOString())
    .order("closes_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// Monday of the current (UTC) week -- the calendar week this recap covers.
function currentWeekOf() {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
  return monday.toISOString().slice(0, 10);
}

// Same "decided=0 sinks to bottom" ranking rule as the group page's
// leaderboard (rankValue in app/groups/[id]/index.tsx), so the countdown
// order matches what members already see there.
function rankValue(record) {
  const decided = record.wins + record.losses;
  return decided === 0 ? -1 : record.wins / decided;
}

// Standings rank: 1 = best record, N = worst. Ties broken by name so the
// order is stable across runs.
function assignRanks(members) {
  const sorted = [...members].sort(
    (a, b) => rankValue(b.overallRecord) - rankValue(a.overallRecord) || a.name.localeCompare(b.name)
  );
  sorted.forEach((m, i) => { m.rank = i + 1; });
}

function computeStreak(decidedResultsAsc) {
  if (decidedResultsAsc.length === 0) return null;
  const last = decidedResultsAsc[decidedResultsAsc.length - 1];
  let length = 0;
  for (let i = decidedResultsAsc.length - 1; i >= 0; i--) {
    if (decidedResultsAsc[i] !== last) break;
    length++;
  }
  return { type: last, length };
}

async function buildGroupPayload(supabase, group, closedWeeks) {
  const { data: gm } = await supabase.from("group_members").select("user_id").eq("group_id", group.id);
  const rosterIds = (gm ?? []).map((r) => r.user_id);
  if (rosterIds.length === 0) return null;

  const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", rosterIds);
  const nameById = new Map(
    rosterIds.map((uid) => {
      const p = (profs ?? []).find((x) => x.id === uid);
      return [uid, p?.username || p?.display_name || uid];
    })
  );

  // This week's picks, per league, using whichever week just closed for
  // that league (falls back to nothing if the league hasn't started yet).
  const thisWeekPicksByUser = new Map(rosterIds.map((uid) => [uid, []]));
  for (const league of ["nfl", "cfb"]) {
    const w = closedWeeks[league];
    if (!w) continue;
    const { data: rows } = await supabase
      .from("picks_feed")
      .select("id, user_id, sport, week, slot, market, team, line")
      .eq("group_id", group.id)
      .eq("sport", league)
      .eq("week", w.week_num);
    (rows ?? []).forEach((p) => {
      const list = thisWeekPicksByUser.get(p.user_id);
      if (list) list.push(p);
    });
  }

  // Overall record (both sports combined) -- same source as the group
  // page's leaderboard (member_records), so numbers match what members see.
  const { data: recordRows } = await supabase.from("member_records").select("user_id, wins, losses").eq("group_id", group.id);
  const overallByUser = new Map(rosterIds.map((uid) => [uid, { wins: 0, losses: 0 }]));
  (recordRows ?? []).forEach((r) => {
    const cur = overallByUser.get(r.user_id) ?? { wins: 0, losses: 0 };
    cur.wins += r.wins;
    cur.losses += r.losses;
    overallByUser.set(r.user_id, cur);
  });

  // Current streak: full decided (win/loss, pushes excluded) history in
  // real chronological (kickoff) order.
  const { data: allPicks } = await supabase.from("picks").select("id, user_id, game_id").eq("group_id", group.id);
  const { data: allResults } = await supabase.from("pick_results").select("pick_id, result").eq("group_id", group.id);
  const resultByPickId = new Map((allResults ?? []).map((r) => [r.pick_id, r.result]));
  const gameIds = [...new Set((allPicks ?? []).map((p) => p.game_id).filter((x) => x != null))];
  const { data: games } = gameIds.length
    ? await supabase.from("games").select("id, kickoff_at").in("id", gameIds)
    : { data: [] };
  const kickoffByGameId = new Map((games ?? []).map((g) => [g.id, g.kickoff_at]));

  const decidedByUser = new Map(rosterIds.map((uid) => [uid, []]));
  (allPicks ?? []).forEach((p) => {
    const result = resultByPickId.get(p.id);
    if (result !== "win" && result !== "loss") return;
    const kickoff = kickoffByGameId.get(p.game_id);
    if (!kickoff) return;
    const list = decidedByUser.get(p.user_id);
    if (list) list.push({ kickoff, result });
  });

  const members = rosterIds.map((uid) => {
    const decided = (decidedByUser.get(uid) ?? [])
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
      .map((x) => x.result);
    return {
      user_id: uid,
      name: nameById.get(uid) ?? uid,
      thisWeekPicks: (thisWeekPicksByUser.get(uid) ?? []).map((p) => ({
        sport: p.sport, team: p.team, line: p.line, market: p.market, slot: p.slot,
        result: resultByPickId.get(p.id) ?? "pending",
      })),
      overallRecord: overallByUser.get(uid) ?? { wins: 0, losses: 0 },
      streak: computeStreak(decided),
    };
  });

  assignRanks(members);

  return { members, nameToId: new Map(members.map((m) => [m.name, m.user_id])) };
}

async function generateRecapsForGroup(anthropic, groupName, members) {
  const memberNames = members.map((m) => m.name);
  const totalMembers = members.length;
  // Worst to best (highest rank number first) -- a power-rankings countdown
  // builds toward the leader, so the data arrives in that order too.
  const dataBlock = [...members]
    .sort((a, b) => b.rank - a.rank)
    .map((m) => ({
      rank: `#${m.rank} of ${totalMembers}`,
      name: m.name,
      this_week_picks: m.thisWeekPicks.length
        ? m.thisWeekPicks.map((p) => `${p.sport.toUpperCase()} ${p.market} — ${p.team ?? "?"} ${p.line ?? ""} (${p.result})`.trim())
        : ["no pick made this week"],
      overall_record: `${m.overallRecord.wins}-${m.overallRecord.losses}`,
      streak: m.streak ? `${m.streak.length}-game ${m.streak.type} streak` : "no decided streak yet",
    }));

  const tool = {
    name: "submit_recaps",
    description: "Submit one roast recap per group member.",
    input_schema: {
      type: "object",
      properties: {
        recaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              member_name: { type: "string", enum: memberNames },
              recap_text: { type: "string" },
            },
            required: ["member_name", "recap_text"],
          },
        },
      },
      required: ["recaps"],
    },
  };

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400 + members.length * 200,
    system:
      "You are the trash-talking commissioner bot for a friend group's football pick'em app called WeekendLocks. " +
      "Every week you write that group's Power Rankings — a countdown roast, worst record to best, in the style " +
      "of a sports-blog power-rankings column. Go FULL SAVAGE — no-holds-barred, ruthless trash talk between " +
      "friends, the kind of ribbing a real friend group would send in a group chat. Member data is given to you " +
      "already ordered worst to best; write each person's entry in that same order, referencing their rank " +
      "('#4 of 6', dead last, clawing up the board, etc) alongside specific teams, lines, and streaks so it's " +
      "unmistakably about THEIR week. Someone with no pick this week should get roasted hardest of all for " +
      "chickening out. Someone near the bottom gets buried without mercy. Someone on a hot streak gets a " +
      "backhanded compliment. The person in first place still gets clowned — power rankings never let the " +
      "leader off easy, needle their luck or their soft schedule rather than praising them straight. " +
      "Ground every joke in the actual pick/record/streak data given — never invent personal facts, incidents, " +
      "or backstory about someone that isn't in that data, and never use slurs or punch at anything outside " +
      "football/gambling performance (no real-world tragedy, health, appearance, sexuality, etc). 2-4 sentences " +
      "per person. The app already displays each person's name, avatar, and rank badge right next to your text — " +
      "do NOT start your entry with their name, a '#N' prefix, or their record as a label; weave the rank and " +
      "stats into the roast itself instead. Use the submit_recaps tool with one entry per member, using their " +
      "exact name as given.",
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_recaps" },
    messages: [
      {
        role: "user",
        content: `Group: ${groupName}\n\nMember data:\n${JSON.stringify(dataBlock, null, 2)}`,
      },
    ],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  return toolUse?.input?.recaps ?? [];
}

async function runWeeklyRecapJob() {
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");
  if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  await Promise.all([refreshScores(supabase, "nfl"), refreshScores(supabase, "cfb")]);

  const closedWeeks = {
    nfl: await mostRecentClosedWeek(supabase, "nfl"),
    cfb: await mostRecentClosedWeek(supabase, "cfb"),
  };
  const weekOf = currentWeekOf();

  const { data: groups } = await supabase.from("groups").select("id, name");
  const summary = [];

  for (const group of groups ?? []) {
    const payload = await buildGroupPayload(supabase, group, closedWeeks);
    const hasAnyActivity =
      payload &&
      payload.members.some(
        (m) => m.thisWeekPicks.length > 0 || m.overallRecord.wins > 0 || m.overallRecord.losses > 0
      );
    if (!hasAnyActivity) {
      summary.push({ group: group.name, skipped: true });
      continue;
    }

    const recaps = await generateRecapsForGroup(anthropic, group.name, payload.members);
    const rankByName = new Map(payload.members.map((m) => [m.name, m.rank]));
    const rows = recaps
      .map((r) => ({
        group_id: group.id,
        user_id: payload.nameToId.get(r.member_name),
        week_of: weekOf,
        recap_text: r.recap_text,
        rank: rankByName.get(r.member_name) ?? null,
      }))
      .filter((r) => r.user_id);

    if (rows.length) {
      await supabase.from("weekly_recaps").upsert(rows, { onConflict: "group_id,user_id,week_of" });
    }
    summary.push({ group: group.name, recaps: rows.length });
  }

  return { weekOf, groups: summary };
}

module.exports = async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const result = await runWeeklyRecapJob();
    res.status(200).json(result);
  } catch (err) {
    console.error("generate-weekly-recaps failed:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
};
module.exports.runWeeklyRecapJob = runWeeklyRecapJob;
