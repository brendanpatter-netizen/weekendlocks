-- WeekendLocks migration: 2026-08-11d
-- Safe to re-run. CRITICAL FIX: handle_new_user() (the trigger that runs on
-- every new auth.users signup) was inserting into public.profiles.avatar_url,
-- a column that does not exist on this table. That insert has been failing
-- with "column profiles.avatar_url does not exist" on EVERY signup, which
-- fails the whole auth.users insert transaction — meaning no new user has
-- been able to sign up at all. Nothing in the app reads/writes avatar_url
-- (avatars are rendered client-side from initials + a deterministic color,
-- see lib/avatar.ts), so we just stop referencing the missing column instead
-- of adding it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'User'))
  on conflict (id) do nothing;
  return new;
end;
$function$;
