-- WeekendLocks migration: 2026-08-10b
-- Safe to re-run. Pure de-duplication: drops indexes that are exact or
-- functional duplicates of another index that stays. No app code targets
-- any of the dropped names directly (only "group_id,user_id,sport,week" is
-- used as an onConflict arbiter anywhere in the codebase), and no behavior
-- changes — each dropped index has a surviving twin enforcing the same rule.

-- picks: (group_id, user_id, game_id) is enforced 5 different ways.
-- group_id is NOT NULL, so the "WHERE group_id IS NOT NULL" partial indexes
-- are equivalent to the unconditional ones. Keep picks_group_user_game_unique.
drop index if exists public.picks_group_user_game_uniq_idx;
drop index if exists public.picks_user_game_group_key;
drop index if exists public.picks_group_uniq;
drop index if exists public.uq_picks_user_group_game;

-- picks: (user_id, game_id) duplicated. Keep picks_user_game_uq.
drop index if exists public.picks_user_game_unique;

-- picks: (user_id, game_id, market) is strictly weaker than (user_id, game_id)
-- above — since (user_id, game_id) is already unique, no row can ever violate
-- the market-scoped version without first violating the game-scoped one, so
-- it can never be the constraint that actually blocks anything.
drop index if exists public.picks_user_game_mkt_uq;

-- games: (home, away, kickoff_at) duplicated. Keep games_unique_home_away_kickoff
-- (matches what upsert_game_from_feed's ON CONFLICT targets).
drop index if exists public.ux_games_home_away_time;

-- groups: (invite_code) duplicated — groups_invite_code_key is the real named
-- unique constraint; uq_groups_invite_code is a redundant bare index.
drop index if exists public.uq_groups_invite_code;

-- group_members: (group_id, user_id) already enforced by the primary key;
-- group_members_unique is a redundant duplicate — it's a named UNIQUE
-- constraint (not a bare index), so it needs DROP CONSTRAINT rather than
-- DROP INDEX.
alter table public.group_members drop constraint if exists group_members_unique;

-- profiles: "no client inserts" (INSERT, with_check false) contributes nothing
-- to a permissive policy set — it's OR'd with profiles_insert_self, which
-- already allows self-inserts, so this policy can never be what blocks
-- anything. Safe to drop as pure dead weight.
drop policy if exists "no client inserts" on public.profiles;
