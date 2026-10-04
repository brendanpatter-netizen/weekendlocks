-- WeekendLocks migration: 2026-09-20
-- Every week boundary (both leagues) currently flips at exactly Tuesday
-- 00:00 UTC — which is Monday evening in every US time zone (8pm ET),
-- landing squarely in the middle of Monday Night Football instead of after
-- it. That's why CFB's next week (and NFL's) would show as "open" while
-- that week's own MNF game was still being played. Shifts every 2026
-- boundary from Tuesday 00:00 UTC to Tuesday 10:00 UTC (6am ET) — the same
-- moment the once-daily grading sweep already runs (see vercel.json's
-- /api/refresh-scores cron), so the new week opens only after last week's
-- scores are final, two hours before the Tuesday recap bot posts using
-- that now-settled data.
--
-- cfb week_num=5 (id 138) has drifted back into the same corruption this
-- project has now hit twice (see 2026-09-16) — it held a clean
-- 2026-09-22T00:00:00Z/2026-09-29T00:00:00Z as of this session's earlier
-- check, and now holds a "now()-ish" 7-day-wide value instead
-- (2026-09-20T10:57:35.../2026-09-27T10:57:35...). Neither ensure_week_row
-- (a 28-day span) nor any tracked cron/job in this repo produces that
-- shape, and no GitHub Actions workflow exists either — the actual writer
-- is something outside this codebase (most likely a Supabase-side pg_cron
-- job or scheduled Edge Function). Flagged to the user to check Supabase's
-- own dashboard for it; this just repairs the value before the shift below.
update public.weeks
set opens_at = '2026-09-22T00:00:00Z', closes_at = '2026-09-29T00:00:00Z'
where league = 'cfb' and season = 2026 and week_num = 5;

-- Applied uniformly to both leagues so they stay aligned — the Weekly
-- Locks grid and Live Board's row/week matching (see the 2026-09-16 and
-- 2026-09-17 migrations) depend on NFL and CFB opening/closing at the same
-- real moment each week.
update public.weeks
set opens_at = opens_at + interval '10 hours',
    closes_at = closes_at + interval '10 hours'
where season = 2026 and league in ('nfl', 'cfb');

-- Keep any future auto-created week (a new season before next year's seed
-- migration runs, or CFB bowl weeks beyond the pre-seeded range) aligned to
-- the same Tuesday-10:00-UTC convention instead of plain midnight.
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
    date_trunc('day', _kick - interval '14 days') + interval '10 hours',
    date_trunc('day', _kick + interval '14 days') + interval '10 hours'
  )
  on conflict (league, season, week_num) do nothing;
end;
$function$;
