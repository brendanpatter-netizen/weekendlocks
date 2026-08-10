-- WeekendLocks migration: 2026-08-10f
-- Safe to re-run. Fixes a real bug: ensure_week_row() hardcoded
-- weeks.id = the raw week number, so NFL and CFB week rows collide on id
-- (both want id=7 for "week 7"), and any new season permanently loses to
-- on conflict (id) do nothing the moment a week number repeats. The old
-- CFB rows were manually seeded at id 101-115 to dodge this by hand; the
-- functions were never updated to know that. This rewrites both functions
-- to key on (league, season, week_num) — the natural key the
-- weeks_league_season_week_num_key unique constraint already expects —
-- and seeds the 2026 season so games/picks resolve to the right week.
--
-- Existing weeks/games/picks rows are untouched; this only changes future
-- behavior and adds new 2026 rows.

create or replace function public.ensure_week_row(_league text, _week integer, _kick timestamp with time zone)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.weeks (league, season, week_num, opens_at, closes_at)
  values (
    _league::league_t,
    extract(year from _kick)::int,
    _week,
    _kick - interval '14 days',
    _kick + interval '14 days'
  )
  on conflict (league, season, week_num) do nothing;
end;
$function$;

create or replace function public.upsert_game_from_feed(
  _league text, _week integer, _kickoff_at timestamp with time zone,
  _home text, _away text, _external_id text default null
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _id bigint;
  _ext text;
  _week_id bigint;
begin
  perform public.ensure_week_row(_league, _week, _kickoff_at);

  select w.id into _week_id
  from public.weeks w
  where w.league = _league::league_t
    and w.season = extract(year from _kickoff_at)::int
    and w.week_num = _week;

  _ext := coalesce(
    _external_id,
    'loc:' ||
    lower(regexp_replace(_league, '\s+', '-', 'g')) || ':' ||
    _week || ':' ||
    lower(regexp_replace(_home, '\s+', '-', 'g')) || '@' ||
    lower(regexp_replace(_away, '\s+', '-', 'g')) || ':' ||
    to_char(_kickoff_at, 'YYYYMMDDHH24MISS')
  );

  insert into public.games (external_id, week_id, kickoff_at, home, away, spread, status)
  values (_ext, _week_id, _kickoff_at, _home, _away, null, 'scheduled')
  on conflict (home, away, kickoff_at)
  do update set week_id = excluded.week_id
  returning id into _id;

  if _id is null then
    select id into _id
    from public.games
    where home = _home and away = _away and kickoff_at = _kickoff_at
    order by id desc
    limit 1;
  end if;

  return _id;
end;
$function$;

-- The old buggy ensure_week_row() always assigned id manually, so
-- weeks_id_seq never advanced past its starting value and is still handing
-- out ids that existing rows already occupy (e.g. id=3). Resync it to the
-- real max id before anything below (or any future ensure_week_row call)
-- tries to insert a normal, sequence-assigned row.
select setval('weeks_id_seq', (select coalesce(max(id), 0) from public.weeks));

-- Seed the 2026 season: clean, non-overlapping 7-day windows starting at
-- the same "Tuesday before opening kickoff" boundary lib/nflWeeks.ts and
-- lib/cfbWeeks.ts use. Estimated season-open dates (NFL: Thursday after
-- Labor Day; CFB: last week of August) — revisit once real schedules are
-- published; safe to update the two constants below and re-run.
insert into public.weeks (league, season, week_num, opens_at, closes_at)
select 'nfl'::league_t, 2026, n,
       timestamptz '2026-09-08T00:00:00Z' + (n - 1) * interval '7 days',
       timestamptz '2026-09-08T00:00:00Z' + n * interval '7 days'
from generate_series(1, 18) as n
on conflict (league, season, week_num) do nothing;

insert into public.weeks (league, season, week_num, opens_at, closes_at)
select 'cfb'::league_t, 2026, n,
       timestamptz '2026-08-25T00:00:00Z' + (n - 1) * interval '7 days',
       timestamptz '2026-08-25T00:00:00Z' + n * interval '7 days'
from generate_series(1, 15) as n
on conflict (league, season, week_num) do nothing;
