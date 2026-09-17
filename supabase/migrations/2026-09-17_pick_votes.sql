-- WeekendLocks migration: 2026-09-17
-- Adds peer voting on locks: any group member can tag another member's
-- pick as "good pick" or "no way this hits" while it's still pre-kickoff
-- banter (once the game starts, the outcome speaks for itself). One vote
-- per (pick, voter), changeable up until kickoff — same window as editing
-- your own pick (see 2026-08-11c).
--
-- Mirrors the existing picks RLS shape (group-membership check via
-- group_members) and the pick_results/member_records view pattern
-- (security_invoker view joining profiles for a display name).

create table if not exists public.pick_votes (
  id uuid primary key default gen_random_uuid(),
  pick_id uuid not null references public.picks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('good', 'bad')),
  created_at timestamptz not null default now(),
  unique (pick_id, user_id)
);

alter table public.pick_votes enable row level security;

create policy "pick_votes_select_group" on public.pick_votes
for select using (
  exists (
    select 1 from public.picks p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = pick_votes.pick_id and gm.user_id = auth.uid()
  )
);

create policy "pick_votes_insert_member" on public.pick_votes
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.picks p
    join public.group_members gm on gm.group_id = p.group_id
    left join public.games g on g.id = p.game_id
    where p.id = pick_votes.pick_id and gm.user_id = auth.uid()
      and (g.kickoff_at is null or now() < g.kickoff_at)
  )
);

create policy "pick_votes_update_member" on public.pick_votes
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.picks p
    left join public.games g on g.id = p.game_id
    where p.id = pick_votes.pick_id
      and (g.kickoff_at is null or now() < g.kickoff_at)
  )
);

create policy "pick_votes_delete_member" on public.pick_votes
for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.pick_votes to authenticated;

create or replace view public.pick_vote_details as
select
  pv.pick_id,
  pv.user_id,
  pv.vote,
  coalesce(pr.display_name, pr.username) as voter_name
from public.pick_votes pv
join public.profiles pr on pr.id = pv.user_id;

alter view public.pick_vote_details set (security_invoker = true);
grant select on public.pick_vote_details to authenticated;
