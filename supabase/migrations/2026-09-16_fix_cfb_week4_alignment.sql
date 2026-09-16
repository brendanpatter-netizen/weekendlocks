-- WeekendLocks migration: 2026-09-16
-- Fixes a real bug: cfb week_num=4 (season 2026, id 137) got created by
-- ensure_week_row() (see 2026-08-10f) — via a live schedule sync calling
-- upsert_game_from_feed() for a week-4 game — before the manual season-seed
-- insert in that same migration reached week_num=4, so its "on conflict do
-- nothing" left ensure_week_row()'s kickoff-relative window in place
-- instead of the clean, day-aligned boundary every other 2026 week has.
-- That window carried a sub-day time-of-day component (opens 10:57:35, not
-- midnight) that didn't match NFL week 2's opens_at, even though both cover
-- the same real calendar week — so they landed on separate rows in the
-- group dashboard's Weekly Locks grid instead of sharing one (see
-- components/WeeklyPicksGrid.tsx's buildWeekRows, which groups by exact
-- opens_at equality).
--
-- Corrects the existing bad row and truncates ensure_week_row()'s computed
-- boundaries to day granularity so any future auto-created week (a new
-- season before next year's seed migration runs, or CFB bowl weeks beyond
-- the pre-seeded range) can't reintroduce the same sub-day skew.

update public.weeks
set opens_at = '2026-09-15T00:00:00Z', closes_at = '2026-09-22T00:00:00Z'
where league = 'cfb' and season = 2026 and week_num = 4;

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
    date_trunc('day', _kick - interval '14 days'),
    date_trunc('day', _kick + interval '14 days')
  )
  on conflict (league, season, week_num) do nothing;
end;
$function$;
