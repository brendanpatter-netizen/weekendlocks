-- WeekendLocks migration: 2026-09-07b
-- Safe to re-run. Adds live (in-progress) score tracking for the group
-- "Live Board" — a lobby view of this week's locks colored against the
-- real-time score, not just the final result.
--
-- record_game_score (2026-08-10i) always sets status='final', which is
-- correct for the once-a-day grading sweep but wrong for an in-progress
-- score: marking a game final with a mid-game score would grade every pick
-- on it early and wrong. record_live_score is the same shape but sets
-- status='live' instead, and refuses to touch a game that's already final
-- (a stray late poll should never downgrade a graded game).
create or replace function public.record_live_score(
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
      status = 'live'
  where id = _game_id
    and status <> 'final';
end;
$function$;

grant execute on function public.record_live_score(bigint, integer, integer) to authenticated;

-- live_poll_state: a one-row-per-league debounce gate so N people with the
-- Live Board open at once still only trigger one real Odds API call per
-- window, not N — the client just pings on an interval, and whichever
-- request's UPDATE actually claims the row (last_polled_at old enough) is
-- the one that pays for and makes the external call. Internal bookkeeping
-- only, never read or written directly by client code.
create table if not exists public.live_poll_state (
  league text primary key,
  last_polled_at timestamptz not null default '2000-01-01T00:00:00Z'
);
insert into public.live_poll_state (league) values ('nfl'), ('cfb')
  on conflict (league) do nothing;

alter table public.live_poll_state enable row level security;
