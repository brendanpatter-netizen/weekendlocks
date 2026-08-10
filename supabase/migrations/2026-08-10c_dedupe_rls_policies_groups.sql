-- WeekendLocks migration: 2026-08-10c
-- Safe to re-run. Consolidates duplicate RLS policies on groups, group_members,
-- and profiles down to one policy per command. Verified no-op on behavior:
-- create_group() has an AFTER INSERT trigger (add_group_owner_as_member) that
-- already adds the owner as a group_members row, so every "owner" check is a
-- subset of the "member" check that survives — nothing loses access.
-- (picks is deliberately NOT included here — see the separate note.)

-- group_members ---------------------------------------------------------
drop policy if exists "gm_delete" on public.group_members;
drop policy if exists "gm_delete_owner" on public.group_members;
drop policy if exists "gm_delete_self" on public.group_members;
drop policy if exists "group_members_delete_self" on public.group_members;
drop policy if exists "group_members_delete_owner" on public.group_members;
-- keeps: group_members_delete (user_id = auth.uid() OR is_group_owner(group_id))

drop policy if exists "group_members_insert_self" on public.group_members;
drop policy if exists "group_members_insert" on public.group_members;
drop policy if exists "gm_insert_owner" on public.group_members;
drop policy if exists "gm_insert_self" on public.group_members;
drop policy if exists "gm_self_insert" on public.group_members;
-- keeps: gm_insert (user_id = auth.uid() OR owner-adds-member)

drop policy if exists "group_members_select_owner" on public.group_members;
drop policy if exists "gm_select_self" on public.group_members;
drop policy if exists "gm_self_select" on public.group_members;
drop policy if exists "group_members: user can read own memberships" on public.group_members;
drop policy if exists "group_members_select_own" on public.group_members;
drop policy if exists "group_members_select_self" on public.group_members;
drop policy if exists "group_members_select_self_only" on public.group_members;
drop policy if exists "gm: user can read own" on public.group_members;
-- keeps: gm_select_group_if_member (own row, OR any row in a group you belong to —
-- this is the one that makes the full member roster visible)

drop policy if exists "gm_update" on public.group_members;
-- keeps: group_members_update (user_id = auth.uid() OR is_group_owner(group_id))

-- groups ------------------------------------------------------------------
drop policy if exists "groups_owner_delete" on public.groups;
drop policy if exists "groups_delete_owner" on public.groups;
drop policy if exists "groups_delete" on public.groups;

drop policy if exists "groups_insert" on public.groups;
drop policy if exists "groups_owner_insert" on public.groups;
drop policy if exists "groups_insert_owner" on public.groups;

drop policy if exists "groups_select_member" on public.groups;
drop policy if exists "groups_select" on public.groups;
drop policy if exists "groups: owners or members can read" on public.groups;
drop policy if exists "groups_member_read" on public.groups;
drop policy if exists "groups_member_select" on public.groups;
drop policy if exists "groups_owner_read" on public.groups;
drop policy if exists "groups_owner_select" on public.groups;
drop policy if exists "groups_select_owner" on public.groups;
drop policy if exists "groups_select_owner_or_member" on public.groups;

drop policy if exists "groups_update" on public.groups;
drop policy if exists "groups_owner_update" on public.groups;
drop policy if exists "groups_update_owner" on public.groups;
-- keeps: groups_owner_full (ALL, owner_user_id = auth.uid() — covers owner CRUD)
-- keeps: groups_owner_or_member_read (SELECT, owner OR member — covers non-owner
-- members, and deliberately checks owner_user_id too as a safety net for any
-- group that predates the owner-membership trigger)

-- profiles ------------------------------------------------------------------
drop policy if exists "profile_select_own" on public.profiles;
drop policy if exists "Users can read their profile" on public.profiles;
drop policy if exists "profiles_read_public" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_all_usernames" on public.profiles;
drop policy if exists "read all profiles" on public.profiles;
-- keeps: profiles_read_all (SELECT, true)

drop policy if exists "update my profile" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "Users can edit their profile" on public.profiles;
-- keeps: profile_update_own (UPDATE, id = auth.uid(), explicit with_check)
