-- WeekendLocks migration: 2026-08-10
-- Safe to re-run. Adds display_name to profiles (backfilled, non-destructive),
-- creates the missing picks_feed view the group page depends on, and drops
-- two dead partial indexes left over from an abandoned solo-pick design
-- (they targeted group_id IS NULL, but picks.group_id is NOT NULL, so they
-- can never match a row).

-- 1) Add display_name to profiles, only if missing.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) then
    alter table public.profiles add column display_name text;
  end if;
end $$;

-- 2) Backfill display_name from username, but never overwrite an existing value.
update public.profiles
set display_name = username
where display_name is null
  and username is not null;

-- 3) picks_feed view: names instead of UUIDs, includes updated_at so the app
-- can distinguish "picked" vs "replaced a pick". was_replaced is computed here
-- (not client-side) because picks.created_at is `timestamp without time zone`
-- while updated_at has a zone — Postgres resolves that skew consistently via
-- the session timezone; a browser comparing the two raw strings would not.
create or replace view public.picks_feed as
select
  p.id,
  p.group_id,
  p.user_id,
  coalesce(pr.display_name, pr.username, p.user_id::text) as display_name,
  p.sport,
  p.week,
  p.market,
  p.team,
  p.line,
  p.price,
  p.created_at,
  p.updated_at,
  (p.updated_at - p.created_at) > interval '5 seconds' as was_replaced
from public.picks p
join public.profiles pr on pr.id = p.user_id;

grant select on public.picks_feed to authenticated;

-- 4) Drop dead solo-pick indexes (group_id is NOT NULL, so "WHERE group_id IS NULL"
-- can never match — these have been no-ops since the column was made required).
drop index if exists public.picks_solo_uniq;
drop index if exists public.uq_picks_user_game_solo;
