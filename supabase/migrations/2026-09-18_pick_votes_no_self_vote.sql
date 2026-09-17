-- WeekendLocks migration: 2026-09-18
-- Closes a real gap in 2026-09-17_pick_votes.sql: "can't vote on your own
-- pick" was only enforced by disabling the button client-side — nothing in
-- the insert/update policies actually stopped a pick's own owner from
-- voting on it via a direct API call. Adds that check at the RLS layer too,
-- the same defense-in-depth the picks-lock trigger already gets.

drop policy if exists "pick_votes_insert_member" on public.pick_votes;
create policy "pick_votes_insert_member" on public.pick_votes
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.picks p
    join public.group_members gm on gm.group_id = p.group_id
    left join public.games g on g.id = p.game_id
    where p.id = pick_votes.pick_id and gm.user_id = auth.uid()
      and p.user_id <> auth.uid()
      and (g.kickoff_at is null or now() < g.kickoff_at)
  )
);

drop policy if exists "pick_votes_update_member" on public.pick_votes;
create policy "pick_votes_update_member" on public.pick_votes
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.picks p
    left join public.games g on g.id = p.game_id
    where p.id = pick_votes.pick_id
      and p.user_id <> auth.uid()
      and (g.kickoff_at is null or now() < g.kickoff_at)
  )
);
