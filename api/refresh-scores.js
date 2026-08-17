// api/refresh-scores.js
// Vercel Cron hits this a few times a week during the season (see
// vercel.json's `crons`) to keep game scores — and therefore standings —
// current without anyone needing to tap "Refresh scores" by hand. Also
// directly requireable for local testing, same pattern as
// generate-weekly-recaps.js's runWeeklyRecapJob.
const { createClient } = require("@supabase/supabase-js");
const { refreshScores } = require("./_lib/refreshScores");

async function runRefreshScoresJob() {
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const [nfl, cfb] = await Promise.all([
    refreshScores(supabase, "nfl"),
    refreshScores(supabase, "cfb"),
  ]);
  return { nfl, cfb };
}

module.exports = async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const result = await runRefreshScoresJob();
    res.status(200).json(result);
  } catch (err) {
    console.error("refresh-scores failed:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
};

module.exports.runRefreshScoresJob = runRefreshScoresJob;
