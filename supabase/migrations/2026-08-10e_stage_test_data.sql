-- WeekendLocks: one-time test data staging (NOT a schema migration — run once,
-- not meant to be idempotent/rerun). Creates a "Test Group" owned by you,
-- stages one NFL pick and one CFB pick for your account using the same
-- games your DB already knows how to create via the real app's
-- upsert_game_from_feed RPC (so this exercises the same path as a real
-- pick, just skipping the UI click). Uses your account's own user_id — no
-- fake accounts. Bypasses RLS because it runs as the SQL editor's role, but
-- everything it creates would also pass RLS if inserted through the app.

-- Your profiles.username/display_name were both null — this only fills
-- display_name if it's still empty, never overwrites.
update public.profiles
set display_name = 'Brendan'
where id = '8f53c1de-1680-4158-9586-628b2fbe7304'
  and display_name is null;

with new_group as (
  insert into public.groups (name, owner_user_id)
  values ('Test Group', '8f53c1de-1680-4158-9586-628b2fbe7304')
  returning id
),
nfl_game as materialized (
  -- kickoff falls inside the seeded 2026 NFL week 1 window (opens 2026-09-08)
  select public.upsert_game_from_feed(
    'nfl', 1, timestamptz '2026-09-10T17:00:00Z',
    'Kansas City Chiefs', 'Buffalo Bills', 'test:nfl:w1:0'
  ) as id
),
cfb_game as materialized (
  -- kickoff falls inside the seeded 2026 CFB week 1 window (opens 2026-08-25)
  select public.upsert_game_from_feed(
    'cfb', 1, timestamptz '2026-08-27T17:00:00Z',
    'Georgia Bulldogs', 'Alabama Crimson Tide', 'test:cfb:w1:0'
  ) as id
)
insert into public.picks (user_id, group_id, sport, week, game_id, market, team, price, line, side, updated_at)
select '8f53c1de-1680-4158-9586-628b2fbe7304'::uuid, new_group.id, 'nfl'::league_t, 1, nfl_game.id,
       'spreads', 'Kansas City Chiefs', -110, '-1', 'home', now()
from new_group, nfl_game
union all
select '8f53c1de-1680-4158-9586-628b2fbe7304'::uuid, new_group.id, 'cfb'::league_t, 1, cfb_game.id,
       'spreads', 'Georgia Bulldogs', -110, '+1', 'home', now()
from new_group, cfb_game
returning *;

-- The output's group_id column is the group to open:
-- https://weekendlocks.com/groups/<group_id>

-- ---------------------------------------------------------------------
-- CLEANUP (run later, separately, only when you're done testing):
--
-- delete from public.picks where group_id in (select id from public.groups where name = 'Test Group' and owner_user_id = '8f53c1de-1680-4158-9586-628b2fbe7304');
-- delete from public.group_members where group_id in (select id from public.groups where name = 'Test Group' and owner_user_id = '8f53c1de-1680-4158-9586-628b2fbe7304');
-- delete from public.groups where name = 'Test Group' and owner_user_id = '8f53c1de-1680-4158-9586-628b2fbe7304';
-- delete from public.games where external_id in ('test:nfl:w1:0', 'test:cfb:w1:0');
