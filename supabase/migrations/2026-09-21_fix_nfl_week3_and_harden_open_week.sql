-- WeekendLocks migration: 2026-09-21
-- nfl week_num=3 (id 118) just got hit by the same recurring corruption
-- that's now touched three different rows in three days (cfb week4, cfb
-- week5, and this one) — a "now()-ish" opens_at (2026-09-21T10:57:35...)
-- that opened week 3 a full day early, while week 2's own Monday Night
-- Football game hadn't been played yet. Every code path in this repo that
-- could write to public.weeks has been checked (ensure_week_row, both
-- Vercel crons, the client) and none produce this shape — the actual
-- writer is outside this codebase (most likely a Supabase-side pg_cron job
-- or scheduled Edge Function not visible from the repo). Repairs the value
-- here; see lib/openWeek.ts for a defensive fix on the read side too.
update public.weeks
set opens_at = '2026-09-22T10:00:00Z', closes_at = '2026-09-29T10:00:00Z'
where league = 'nfl' and season = 2026 and week_num = 3;
