-- WeekendLocks migration: 2026-08-10g
-- Safe to re-run. profiles.username is the only field with a real edit path
-- (the Account page's save_profile RPC writes username, never display_name).
-- picks_feed was preferring display_name first, so editing your name in
-- Account wouldn't change what the activity feed shows. Flip the priority.
create or replace view public.picks_feed as
select
  p.id,
  p.group_id,
  p.user_id,
  coalesce(pr.username, pr.display_name, p.user_id::text) as display_name,
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

-- CREATE OR REPLACE VIEW may not reliably preserve reloptions across a
-- definition change — reassert this explicitly every time. See
-- 2026-08-10h for why this matters (it's what keeps the view scoped to the
-- querying role's RLS instead of the view owner's).
alter view public.picks_feed set (security_invoker = true);
