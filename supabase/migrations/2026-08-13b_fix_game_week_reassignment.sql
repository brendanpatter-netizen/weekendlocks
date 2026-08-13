-- WeekendLocks migration: 2026-08-13b
-- Safe to re-run. upsert_game_from_feed()'s insert used
--   on conflict (home, away, kickoff_at) do update set week_id = excluded.week_id
-- which means ANY call that happens to produce the same (home, away,
-- kickoff_at) triple as an existing row -- e.g. mock data coinciding with a
-- real game, or any two calls resolving different weeks/leagues to the same
-- teams+time -- silently reassigns that game to whatever week the new call
-- resolved, even if it belongs to a completely different week or league.
-- That's a real, live risk: (home, away, kickoff_at) is meant to identify a
-- stable game once created, not something later calls should be able to
-- silently move to a different week out from under existing picks.
--
-- Fix: on conflict, do nothing instead of overwriting week_id. The
-- function's existing fallback lookup (the `if _id is null` block right
-- after) already handles fetching the existing row's id when the insert is
-- a no-op, so this is a one-line, low-risk change -- no other logic needed.
create or replace function public.upsert_game_from_feed(
  _league text, _week integer, _kickoff_at timestamp with time zone,
  _home text, _away text, _external_id text default null
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _id bigint;
  _ext text;
  _week_id bigint;
begin
  perform public.ensure_week_row(_league, _week, _kickoff_at);

  select w.id into _week_id
  from public.weeks w
  where w.league = _league::league_t
    and w.season = extract(year from _kickoff_at)::int
    and w.week_num = _week;

  _ext := coalesce(
    _external_id,
    'loc:' ||
    lower(regexp_replace(_league, '\s+', '-', 'g')) || ':' ||
    _week || ':' ||
    lower(regexp_replace(_home, '\s+', '-', 'g')) || '@' ||
    lower(regexp_replace(_away, '\s+', '-', 'g')) || ':' ||
    to_char(_kickoff_at, 'YYYYMMDDHH24MISS')
  );

  insert into public.games (external_id, week_id, kickoff_at, home, away, spread, status)
  values (_ext, _week_id, _kickoff_at, _home, _away, null, 'scheduled')
  on conflict (home, away, kickoff_at)
  do nothing
  returning id into _id;

  if _id is null then
    select id into _id
    from public.games
    where home = _home and away = _away and kickoff_at = _kickoff_at
    order by id desc
    limit 1;
  end if;

  return _id;
end;
$function$;
