-- WeekendLocks migration: 2026-08-14b
-- Safe to re-run. record_game_score() currently rejects any caller with no
-- auth.uid() (see 2026-08-10i), which is correct for stopping anonymous
-- callers but also blocks the Tuesday-morning recap cron
-- (api/generate-weekly-recaps.js) -- it authenticates with the service role
-- key, not a real user session, so it has no auth.uid() either. Widen the
-- check to also accept the service_role JWT itself. Anonymous/anon-key
-- callers still get rejected either way, so this doesn't open anything up.
create or replace function public.record_game_score(
  _game_id bigint, _home_score integer, _away_score integer
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'not authenticated';
  end if;

  update public.games
  set home_score = _home_score,
      away_score = _away_score,
      status = 'final',
      final_at = coalesce(final_at, now())
  where id = _game_id;
end;
$function$;
