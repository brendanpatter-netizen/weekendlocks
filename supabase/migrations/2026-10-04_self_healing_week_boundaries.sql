-- WeekendLocks migration: 2026-10-04
-- Something outside this codebase has now corrupted a week row five times
-- across three weeks (cfb weeks 4, 5, 6, 7 and nfl week 3) — every tracked
-- code path (both Vercel crons, ensure_week_row, the client, GitHub
-- Actions — there is none) has been checked and none produce the "now()
-- plus a 7-day span" shape these corruptions share. Rather than keep
-- reactively patching one row at a time, this makes the app self-healing:
-- a canonical formula derives the one correct opens_at/closes_at for any
-- (league, week_num) from the same fixed anchors the original
-- 2026-08-10f seed migration used (plus the 2026-09-20 Tuesday-10am-UTC
-- shift), and heal_week_boundaries() corrects any row that's drifted from
-- it. The client calls this opportunistically (see lib/openWeek.ts) so
-- drift gets corrected within moments of anyone using the app, regardless
-- of whether the external writer is ever found and stopped.
--
-- Inlined directly in the UPDATE (rather than joining to a separate
-- set-returning function) — an UPDATE...FROM can't see the target row's
-- columns from a function call there without an explicit LATERAL, and a
-- plain CASE expression sidesteps that entirely.

create or replace function public.heal_week_boundaries()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _fixed integer;
begin
  with corrected as (
    update public.weeks w
    set opens_at = case w.league
          when 'nfl' then timestamptz '2026-09-08T10:00:00Z' + (w.week_num - 1) * interval '7 days'
          when 'cfb' then timestamptz '2026-08-25T10:00:00Z' + (w.week_num - 1) * interval '7 days'
        end,
        closes_at = case w.league
          when 'nfl' then timestamptz '2026-09-08T10:00:00Z' + w.week_num * interval '7 days'
          when 'cfb' then timestamptz '2026-08-25T10:00:00Z' + w.week_num * interval '7 days'
        end
    where w.season = 2026
      and w.league in ('nfl', 'cfb')
      and (
        w.opens_at <> case w.league
          when 'nfl' then timestamptz '2026-09-08T10:00:00Z' + (w.week_num - 1) * interval '7 days'
          when 'cfb' then timestamptz '2026-08-25T10:00:00Z' + (w.week_num - 1) * interval '7 days'
        end
        or w.closes_at <> case w.league
          when 'nfl' then timestamptz '2026-09-08T10:00:00Z' + w.week_num * interval '7 days'
          when 'cfb' then timestamptz '2026-08-25T10:00:00Z' + w.week_num * interval '7 days'
        end
      )
    returning 1
  )
  select count(*) into _fixed from corrected;
  return _fixed;
end;
$function$;

grant execute on function public.heal_week_boundaries() to authenticated;

-- Repair the currently-known drift immediately rather than waiting for the
-- next client call.
select public.heal_week_boundaries();
