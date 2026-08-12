-- WeekendLocks migration: 2026-08-12
-- Safe to re-run. Once a member of a group picks a specific outcome (this
-- game, this market, this team/side, this line), no other member of that
-- same group can also pick it — first to lock it in gets it. Scoped to
-- game_id rather than (sport, week) alone since a game_id already belongs
-- to exactly one week/league via games.week_id.
--
-- coalesce(line, '') so two moneyline picks (line is null) on the same
-- team are still caught — Postgres treats separate NULLs as distinct for
-- uniqueness purposes, which would otherwise let the same ML pick be taken
-- twice.
--
-- Verified against live data before adding this: no existing picks
-- currently collide under this key.
create unique index if not exists picks_unique_outcome_per_group
  on public.picks (group_id, sport, week, game_id, market, team, coalesce(line, ''));
