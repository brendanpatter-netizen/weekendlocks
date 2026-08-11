-- WeekendLocks migration: 2026-08-11b
-- Safe to re-run. House rule: a push counts as a win, and the record
-- displays as plain W-L, not W-L-P. Left pick_results alone (it still
-- reports the literal outcome — win/loss/push — as ground truth); this
-- only changes how member_records aggregates it. Easy to revisit if the
-- rule changes later.
-- CREATE OR REPLACE VIEW can't drop a column (pushes no longer exists in
-- the new definition), so drop it outright first.
drop view if exists public.member_records;

create view public.member_records as
select
  group_id,
  user_id,
  sport,
  count(*) filter (where result in ('win', 'push')) as wins,
  count(*) filter (where result = 'loss') as losses,
  case when count(*) filter (where result is not null) > 0
    then round(100.0 * count(*) filter (where result in ('win', 'push')) / count(*) filter (where result is not null), 1)
    else null
  end as win_pct
from public.pick_results
where result is not null
group by group_id, user_id, sport;

alter view public.member_records set (security_invoker = true);
grant select on public.member_records to authenticated;
