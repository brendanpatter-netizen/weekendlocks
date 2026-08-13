-- WeekendLocks migration: 2026-08-13
-- Safe to re-run. Adds a `slot` column so a user can hold more than one
-- pick for the same (group, sport, week) — needed for the two weekends
-- CFB is live before NFL's season opens, where the app now offers two
-- CFB locks instead of one CFB + one NFL. Every existing row defaults to
-- slot 1, so this is purely additive: the old one-pick-per-user-per-week
-- behavior is just slot 1 by default everywhere except the CFB gap weeks,
-- which explicitly ask for slot 2 as well.
--
-- picks_unique_outcome_per_group (the cross-member exclusivity constraint)
-- is untouched — it doesn't reference slot, so it already stops a user's
-- own two locks from landing on the exact same outcome as each other, same
-- as it stops two different members from doing so.
alter table public.picks add column if not exists slot smallint not null default 1;

-- Belt and suspenders: this constraint may exist either as a real named
-- CONSTRAINT (DROP CONSTRAINT sees it) or as a bare CREATE UNIQUE INDEX
-- from earlier in this project's migration history (only DROP INDEX sees
-- that form) — try both so whichever it actually is gets cleared before
-- the new one is added under the same name.
alter table public.picks drop constraint if exists picks_unique_group_user_sport_week;
drop index if exists picks_unique_group_user_sport_week;

alter table public.picks add constraint picks_unique_group_user_sport_week
  unique (group_id, user_id, sport, week, slot);

-- picks_feed needs to expose slot too (the picks pages read it to tell
-- "your other lock" apart from "someone else's pick"). CREATE OR REPLACE
-- VIEW only allows new columns appended at the END of the select list —
-- putting slot between week and market shifts every later column's
-- position, which Postgres reads as renaming them (42P16). Definition
-- copied from 2026-08-10g with slot appended at the end instead;
-- security_invoker reasserted per that migration's own note that
-- CREATE OR REPLACE doesn't reliably keep it.
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
  p.slot
from public.picks p
join public.profiles pr on pr.id = p.user_id;

alter view public.picks_feed set (security_invoker = true);
