-- WeekendLocks migration: 2026-08-10j — URGENT, run immediately.
-- gm_select_group_if_member (the policy that lets you see OTHER members of
-- your own group, not just your own row) calls rls.is_group_member(group_id)
-- — a function that queries group_members again. That function is NOT
-- security definer, so its own internal query re-triggers this same RLS
-- policy, which calls the function again, recursing until Postgres hits
-- "stack depth limit exceeded".
--
-- This bug already existed, but never fired: groups_for_me previously
-- bypassed RLS entirely (the leak fixed in 2026-08-10h), so nothing ever
-- exercised this path. Fixing that leak is what exposed this — same intent,
-- safe implementation: public.is_group_member(gid, uid) already exists and
-- IS security definer, so its internal query bypasses RLS instead of
-- re-triggering it. Swap to that; behavior is identical, no more recursion.
drop policy if exists "gm_select_group_if_member" on public.group_members;

create policy "gm_select_group_if_member"
on public.group_members
for select
to authenticated
using (
  (user_id = auth.uid()) or public.is_group_member(group_id, auth.uid())
);
