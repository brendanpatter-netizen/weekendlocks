-- WeekendLocks migration: 2026-09-19
-- Adds an optional profile badge — a member picks one of a fixed set of
-- drawn icons (see lib/badges.ts / components/BadgeIcon.tsx) to show next
-- to their name on the groups list and their own Account page. A new
-- security-definer RPC rather than extending the existing (untracked)
-- save_profile RPC, so this doesn't need to know or touch that function's
-- current behavior — same pattern as record_game_score/ensure_week_row.
-- The whitelist is enforced server-side too, not just by the picker UI.

alter table public.profiles add column if not exists badge_id text;

create or replace function public.set_profile_badge(p_badge_id text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_badge_id is not null and p_badge_id not in (
    'trophy', 'flame', 'star', 'lightning', 'target', 'crown',
    'shield', 'horseshoe', 'football', 'megaphone', 'dumbbell', 'clover'
  ) then
    raise exception 'invalid badge_id';
  end if;
  update public.profiles set badge_id = p_badge_id where id = auth.uid();
end;
$function$;

grant execute on function public.set_profile_badge(text) to authenticated;
