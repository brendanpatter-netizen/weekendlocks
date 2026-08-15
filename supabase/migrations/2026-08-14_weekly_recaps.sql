-- WeekendLocks migration: 2026-08-14
-- Safe to re-run. Adds weekly_recaps: AI-generated per-member smack-talk
-- recaps, written by a Tuesday-morning cron job (api/generate-weekly-recaps.ts)
-- using the service role key, read by group members on the group page.
-- `week_of` is the Monday date of the week being recapped -- calendar-based
-- rather than tied to either league's week_num, since NFL and CFB run their
-- own independent week_num counters (offset by ~2 once CFB's early gap
-- weeks are past) and a recap should cover "what happened this calendar
-- week" for whichever picks each member made, regardless of per-league
-- numbering.
create table if not exists public.weekly_recaps (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_of date not null,
  recap_text text not null,
  generated_at timestamptz not null default now()
);

create unique index if not exists weekly_recaps_unique_member_week
  on public.weekly_recaps (group_id, user_id, week_of);

create index if not exists weekly_recaps_group_week_idx
  on public.weekly_recaps (group_id, week_of desc);

alter table public.weekly_recaps enable row level security;

-- Members can read their group's recaps. No client insert/update/delete
-- policy -- rows are only written by the cron job via the service role
-- key, which bypasses RLS entirely.
drop policy if exists "weekly_recaps_select_member" on public.weekly_recaps;
create policy "weekly_recaps_select_member"
on public.weekly_recaps
for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));
