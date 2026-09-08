-- WeekendLocks migration: 2026-09-07c
-- Safe to re-run. games.status is backed by an enum (game_status_t) that
-- only had 'scheduled' and 'final' — discovered when record_live_score
-- (2026-09-07b) tried to write 'live' and Postgres rejected it outright.
-- Must be its own migration/statement: ALTER TYPE ... ADD VALUE can't run
-- in the same transaction as anything that uses the new value, and can't
-- run inside a DO block/function body at all — has to be a bare top-level
-- statement.
alter type public.game_status_t add value if not exists 'live';
