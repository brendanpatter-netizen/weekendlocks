// api/admin-stats.js
// Owner-only usage snapshot — signups, groups, and pick activity across the
// whole platform, not just one group. Gated on the caller's own email
// matching ADMIN_EMAIL (server-side only, never bundled into client JS),
// checked against their real Supabase session token the same way
// api/live-scores.js checks "is this a real signed-in user," just with an
// extra identity check on top. A non-match gets a plain 404, not a 403 —
// no reason to confirm to a prying user that an admin endpoint even exists.
// All the actual reads use the service role key, since this data (every
// group, every user) reaches well outside what any one user's RLS access
// should ever cover.
const { createClient } = require("@supabase/supabase-js");

async function listAllUsers(supabase) {
  const perPage = 1000;
  const users = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return users;
}

module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Missing Supabase env vars" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) { res.status(404).json({ error: "not found" }); return; }

  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) { res.status(404).json({ error: "not found" }); return; }
  if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) {
    res.status(404).json({ error: "not found" });
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  try {
    const [users, { data: groups }, { data: members }, { data: profiles }, totalPicks, weekPicks] = await Promise.all([
      listAllUsers(supabase),
      supabase.from("groups").select("id, name, created_at, owner_user_id"),
      supabase.from("group_members").select("group_id, user_id"),
      supabase.from("profiles").select("id, display_name, username"),
      supabase.from("picks").select("id", { count: "exact", head: true }),
      supabase.from("picks").select("id", { count: "exact", head: true })
        .gte("updated_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const newLast7d = users.filter((u) => now - new Date(u.created_at).getTime() < 7 * day).length;
    const newLast30d = users.filter((u) => now - new Date(u.created_at).getTime() < 30 * day).length;
    const activeLast7d = users.filter((u) => u.last_sign_in_at && now - new Date(u.last_sign_in_at).getTime() < 7 * day).length;

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const memberCountByGroup = new Map();
    (members ?? []).forEach((m) => memberCountByGroup.set(m.group_id, (memberCountByGroup.get(m.group_id) ?? 0) + 1));

    const userRows = users
      .map((u) => ({
        id: u.id,
        email: u.email,
        display_name: profileById.get(u.id)?.username || profileById.get(u.id)?.display_name || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const groupRows = (groups ?? [])
      .map((g) => ({
        id: g.id,
        name: g.name,
        created_at: g.created_at,
        member_count: memberCountByGroup.get(g.id) ?? 0,
      }))
      .sort((a, b) => b.member_count - a.member_count);

    res.status(200).json({
      summary: {
        totalUsers: users.length,
        newLast7d,
        newLast30d,
        activeLast7d,
        totalGroups: (groups ?? []).length,
        totalPicks: totalPicks.count ?? 0,
        picksLast7d: weekPicks.count ?? 0,
      },
      users: userRows,
      groups: groupRows,
    });
  } catch (err) {
    console.error("admin-stats failed:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
};
