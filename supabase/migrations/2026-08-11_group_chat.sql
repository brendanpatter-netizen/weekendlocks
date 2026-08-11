-- WeekendLocks migration: 2026-08-11
-- Safe to re-run. Adds group chat: a messages table scoped to group
-- members, RLS using the safe security-definer is_group_member() (not the
-- recursive rls.is_group_member() that caused 2026-08-10j), and enables
-- Supabase Realtime so messages appear live without a page reload.

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists group_messages_group_created_idx
  on public.group_messages (group_id, created_at);

alter table public.group_messages enable row level security;

drop policy if exists "group_messages_select_member" on public.group_messages;
create policy "group_messages_select_member"
on public.group_messages
for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "group_messages_insert_member" on public.group_messages;
create policy "group_messages_insert_member"
on public.group_messages
for insert
to authenticated
with check (user_id = auth.uid() and public.is_group_member(group_id, auth.uid()));

drop policy if exists "group_messages_delete_own" on public.group_messages;
create policy "group_messages_delete_own"
on public.group_messages
for delete
to authenticated
using (user_id = auth.uid());

-- Enable Realtime so INSERTs push to subscribed clients live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;
end $$;
