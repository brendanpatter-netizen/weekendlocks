-- WeekendLocks migration: 2026-09-07
-- Safe to re-run. Fixes two real bugs reported after the first two weeks
-- of live picking:
--
-- 1. A totals pick showed as "taken" (or, worse, let a DIFFERENT game's
--    identical outcome show as taken by the same user) because the old
--    exclusivity key was (game_id, market, team, line) but "team" for a
--    totals pick is literally just "Over"/"Under" on every game — with
--    line still in the key, two DIFFERENT games that happened to share a
--    line (e.g. both "Over 47.5") never collided, which looks fine until
--    you realize the reverse also happened: the SAME game's line moving
--    during the week (odds update) changed the key entirely, so what was
--    "Over 47.5, taken" one day became "Over 44.5, wide open" the next —
--    the system treated a line move as a brand new outcome, letting a
--    second member pick the same real-world side of the same game.
--
-- The fix: exclusivity should be about (this game, this market, this
-- side) — home/away/over/under — never the numeric line, which is
-- exactly what picks.side already captures (computed once at pick time
-- and stored, see computeSide() client-side and picks.side column).
-- Swapping the index to key on side instead of team+line fixes both
-- symptoms with the same change: side already disambiguates a totals
-- pick from the SAME game's other side, and the game_id column already
-- disambiguates from every OTHER game's over/under.
drop index if exists picks_unique_outcome_per_group;

create unique index picks_unique_outcome_per_group
  on public.picks (group_id, sport, week, game_id, market, coalesce(side, ''));

-- picks_feed needs to expose game_id and side too — both picks pages need
-- them client-side to build the same (game, market, side) exclusivity key
-- (to show "taken" correctly) and to look up a pick's game to check
-- whether it's already kicked off (see 2. below). CREATE OR REPLACE VIEW
-- only allows new columns appended at the END of the select list, per the
-- same constraint noted in 2026-08-13's migration.
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
  (p.updated_at - p.created_at) > interval '5 seconds' as was_replaced,
  p.slot,
  p.game_id,
  p.side
from public.picks p
join public.profiles pr on pr.id = p.user_id;

alter view public.picks_feed set (security_invoker = true);
