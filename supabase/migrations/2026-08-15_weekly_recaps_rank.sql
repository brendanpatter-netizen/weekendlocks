-- WeekendLocks migration: 2026-08-15
-- Safe to re-run. Adds `rank` to weekly_recaps so the bot's output can be
-- displayed as a "Power Rankings" countdown (worst to best) instead of an
-- unordered list of per-member roasts -- rank is computed server-side in
-- api/generate-weekly-recaps.js from each member's season record (same
-- rankValue logic as the group page's leaderboard), not left to the model.
alter table public.weekly_recaps add column if not exists rank smallint;
