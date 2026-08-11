-- WeekendLocks migration: 2026-08-10k
-- Safe to re-run. picks_user_game_uq enforces "one pick per game_id across
-- your entire account" — not scoped to a group. That blocks a legitimate
-- scenario: picking the same real-world game in two different groups you
-- belong to, or replacing a pick with a different game whose id you
-- already used in another group. The rule that actually matters — one
-- lock per (group, sport, week) — is picks_unique_group_user_sport_week,
-- untouched by this migration.
alter table public.picks drop constraint if exists picks_user_game_uq;
