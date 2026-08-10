-- WeekendLocks migration: 2026-08-10d
-- Safe to re-run. Consolidates ~25 overlapping/duplicate RLS policies on
-- picks down to 4 correct ones (one per command), and closes two real gaps
-- found during cleanup:
--   1. picks_read_all let ANY signed-in user read every pick in the database,
--      not just their own groups'. Nothing in the app relies on this (no
--      leaderboard/league pages exist anymore) — dead but risky.
--   2. Two insert policies checked group membership but never verified
--      user_id = auth.uid(), while a third checked identity but never
--      verified membership. Combined (permissive policies OR together), a
--      signed-in group member could insert a pick row under a DIFFERENT
--      member's user_id within a shared group, or into a group they don't
--      belong to.
-- Also removes the admin-override update/delete policies: no UI anywhere
-- exposes a moderator role, and the update variant's with_check was
-- unconditionally `true`, meaning an "admin" could rewrite any field on
-- another member's pick — including reassigning it to a different user_id.
-- If you want moderation features later, that's new scope, not a cleanup.

drop policy if exists "picks_self_rw" on public.picks;

-- SELECT: keep picks_select_self_or_group (own rows, or any row in a group
-- you're a member of).
drop policy if exists "picks_select_own" on public.picks;
drop policy if exists "picks_group_read" on public.picks;
drop policy if exists "picks_read_all" on public.picks;
drop policy if exists "picks_read_own" on public.picks;
drop policy if exists "picks_select_self" on public.picks;
drop policy if exists "read picks for my groups" on public.picks;
drop policy if exists "select picks in my groups or solo" on public.picks;

-- INSERT: keep picks_insert_member (auth.uid() = user_id AND is a member of
-- group_id) — the one policy that checks both identity and membership.
drop policy if exists "picks_insert_own" on public.picks;
drop policy if exists "picks_insert_self_and_member" on public.picks;
drop policy if exists "picks_insert_self" on public.picks;
drop policy if exists "insert picks for my groups" on public.picks;
drop policy if exists "insert picks as member" on public.picks;
drop policy if exists "picks_insert_open_window" on public.picks;

-- UPDATE: keep picks_update_self (own row AND still a member of the group).
drop policy if exists "picks_update_open" on public.picks;
drop policy if exists "picks_update_own" on public.picks;
drop policy if exists "picks_update_owner_or_admin" on public.picks;
drop policy if exists "picks_update_pending_self" on public.picks;
drop policy if exists "modify own picks" on public.picks;
drop policy if exists "picks_update_member" on public.picks;

-- DELETE: keep picks_delete_self (own row only).
drop policy if exists "delete own picks" on public.picks;
drop policy if exists "picks_delete_open" on public.picks;
drop policy if exists "picks_delete_owner_or_admin" on public.picks;
