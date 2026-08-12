-- WeekendLocks migration: 2026-08-12b
-- Safe to re-run (every UPDATE is keyed by id, idempotent).
--
-- Prep for gating picks to "only the currently live week": a handful of
-- weeks rows got their opens_at/closes_at stomped to ~now() at various
-- points while testing ensure_week_row()'s auto-create path, which makes
-- them look "open" today regardless of which week they actually are.
-- Verified against live data before writing this — every row below
-- currently has an opens_at or closes_at that's actually just "whenever
-- this got touched during testing" rather than a real calendar date.
--
-- 2025-season rows are stale test data, not deleted outright because
-- some games/picks still reference their week_id — instead they're
-- pushed to real 2025 dates, safely in the past no matter what "today"
-- is set to. 2026-season rows are corrected to the same 7-day cadence
-- every other (uncorrupted) row in that league already follows.

-- 2025 NFL (push safely into the past; exact dates don't matter, only that
-- they're behind any plausible "today")
update public.weeks set opens_at = '2025-08-12T00:00:00Z', closes_at = '2025-09-07T00:00:00Z' where id = 1;  -- wk1
update public.weeks set opens_at = '2025-08-19T00:00:00Z', closes_at = '2025-09-14T00:00:00Z' where id = 2;  -- wk2
update public.weeks set closes_at = '2025-10-12T00:00:00Z' where id = 6;                                     -- wk6 (opens_at already fine)
update public.weeks set opens_at = '2025-09-23T00:00:00Z', closes_at = '2025-10-19T00:00:00Z' where id = 7;  -- wk7
update public.weeks set opens_at = '2025-09-30T00:00:00Z', closes_at = '2025-10-26T00:00:00Z' where id = 8;  -- wk8
update public.weeks set closes_at = '2026-01-04T00:00:00Z' where id = 18;                                    -- wk18 (opens_at already fine)

-- 2025 CFB
update public.weeks set closes_at = '2025-10-13T00:00:00Z' where id = 107;                                   -- wk7 (opens_at already fine)
update public.weeks set opens_at = '2025-10-13T00:00:00Z', closes_at = '2025-10-20T00:00:00Z' where id = 108; -- wk8

-- 2026 NFL — real season cadence, each week = prior week's close, 7 days wide
update public.weeks set opens_at = '2026-09-15T00:00:00Z', closes_at = '2026-09-22T00:00:00Z' where id = 117; -- wk2
update public.weeks set opens_at = '2026-09-22T00:00:00Z', closes_at = '2026-09-29T00:00:00Z' where id = 118; -- wk3
update public.weeks set opens_at = '2026-10-13T00:00:00Z', closes_at = '2026-10-20T00:00:00Z' where id = 121; -- wk6
update public.weeks set opens_at = '2026-10-27T00:00:00Z', closes_at = '2026-11-03T00:00:00Z' where id = 123; -- wk8
update public.weeks set opens_at = '2026-11-10T00:00:00Z', closes_at = '2026-11-17T00:00:00Z' where id = 125; -- wk10

-- 2026 CFB
update public.weeks set opens_at = '2026-09-01T00:00:00Z', closes_at = '2026-09-08T00:00:00Z' where id = 135; -- wk2
