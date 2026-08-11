-- WeekendLocks migration: 2026-08-10h — URGENT, run immediately.
-- picks_feed was created via the SQL editor (as the postgres role), and
-- Postgres views execute against their underlying tables with the OWNER's
-- privileges by default — not the querying role's. Since postgres bypasses
-- RLS, so did every query through this view, regardless of who ran it.
-- Confirmed exploitable: an anonymous request with only the public anon key
-- (embedded in the deployed client bundle) returned real picks from
-- multiple groups and users, unauthenticated.
--
-- security_invoker makes the view run with the QUERYING role's privileges
-- instead, so it respects picks' and profiles' RLS policies like a normal
-- table would. Safe to re-run.
alter view public.picks_feed set (security_invoker = true);

-- groups_for_me isn't currently exploitable (it has its own auth.uid()-based
-- WHERE clause, unlike picks_feed), but it's owned by the same role — apply
-- the same hardening as defense-in-depth. Existing users querying their own
-- groups already have SELECT grants on groups/group_members via
-- groups_owner_or_member_read and gm_select_group_if_member, so this is a
-- no-op for correct usage.
alter view public.groups_for_me set (security_invoker = true);
