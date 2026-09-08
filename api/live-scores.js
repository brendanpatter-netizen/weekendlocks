// api/live-scores.js
// Called from the Live Board page (not Vercel Cron — see
// api/_lib/refreshLiveScores.js for why) while someone actually has it
// open. Any signed-in app user may trigger it (verified via their own
// Supabase session token, the same trust level as any other authenticated
// read in this app) — the per-league debounce in refreshLiveScores caps
// what a ping storm could actually cost.
const { createClient } = require("@supabase/supabase-js");
const { refreshLiveScores } = require("./_lib/refreshLiveScores");

module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Missing Supabase env vars" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: "unauthorized" }); return; }

  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) { res.status(401).json({ error: "unauthorized" }); return; }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  try {
    const [nfl, cfb] = await Promise.all([
      refreshLiveScores(supabase, "nfl"),
      refreshLiveScores(supabase, "cfb"),
    ]);
    res.status(200).json({ nfl, cfb });
  } catch (err) {
    console.error("live-scores failed:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
};
