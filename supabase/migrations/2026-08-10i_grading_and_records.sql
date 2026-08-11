-- WeekendLocks migration: 2026-08-10i
-- Safe to re-run. Adds win/loss/push grading and season records.
--
-- pick_results: per-pick outcome, computed only once a game is final and has
-- scores. Handles spreads (ATS), totals (over/under), and h2h (moneyline).
-- Pushes are their own outcome, not counted as a win or a loss.
--
-- member_records: wins/losses/pushes/win_pct per (group, user, sport).
-- "Overall" (both sports combined) is summed client-side from the two rows
-- rather than added as a third grouping level here.
--
-- record_game_score: a SECURITY DEFINER RPC (same pattern as
-- upsert_game_from_feed) so any signed-in user can report a final score
-- without opening a broad UPDATE policy on games. It only ever sets score
-- + status='final' — nothing else about the game can be changed through it.

create or replace view public.pick_results as
select
  p.id as pick_id,
  p.group_id,
  p.user_id,
  p.sport,
  p.week,
  case
    when p.market = 'spreads' and p.side = 'home' then
      case
        when (g.home_score + coalesce(p.line::numeric, 0)) > g.away_score then 'win'
        when (g.home_score + coalesce(p.line::numeric, 0)) = g.away_score then 'push'
        else 'loss'
      end
    when p.market = 'spreads' and p.side = 'away' then
      case
        when (g.away_score + coalesce(p.line::numeric, 0)) > g.home_score then 'win'
        when (g.away_score + coalesce(p.line::numeric, 0)) = g.home_score then 'push'
        else 'loss'
      end
    when p.market = 'totals' and p.side = 'over' then
      case
        when (g.home_score + g.away_score) > p.line::numeric then 'win'
        when (g.home_score + g.away_score) = p.line::numeric then 'push'
        else 'loss'
      end
    when p.market = 'totals' and p.side = 'under' then
      case
        when (g.home_score + g.away_score) < p.line::numeric then 'win'
        when (g.home_score + g.away_score) = p.line::numeric then 'push'
        else 'loss'
      end
    when p.market = 'h2h' and p.side = 'home' then
      case
        when g.home_score > g.away_score then 'win'
        when g.home_score = g.away_score then 'push'
        else 'loss'
      end
    when p.market = 'h2h' and p.side = 'away' then
      case
        when g.away_score > g.home_score then 'win'
        when g.away_score = g.home_score then 'push'
        else 'loss'
      end
    else null
  end as result
from public.picks p
join public.games g on g.id = p.game_id
where g.status = 'final'
  and g.home_score is not null
  and g.away_score is not null;

alter view public.pick_results set (security_invoker = true);
grant select on public.pick_results to authenticated;

create or replace view public.member_records as
select
  group_id,
  user_id,
  sport,
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result = 'loss') as losses,
  count(*) filter (where result = 'push') as pushes,
  case when count(*) filter (where result in ('win', 'loss')) > 0
    then round(100.0 * count(*) filter (where result = 'win') / count(*) filter (where result in ('win', 'loss')), 1)
    else null
  end as win_pct
from public.pick_results
where result is not null
group by group_id, user_id, sport;

alter view public.member_records set (security_invoker = true);
grant select on public.member_records to authenticated;

create or replace function public.record_game_score(
  _game_id bigint, _home_score integer, _away_score integer
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
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

grant execute on function public.record_game_score(bigint, integer, integer) to authenticated;
