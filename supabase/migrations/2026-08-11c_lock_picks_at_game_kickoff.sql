-- WeekendLocks migration: 2026-08-11c
-- Safe to re-run. Replaces the week-level lock (a fixed 7-day calendar
-- window unrelated to when games actually kick off) with a per-game lock:
-- a pick can be made or changed as long as its game hasn't started yet.
-- Once your CURRENT pick's game kicks off, you're frozen for the week —
-- no switching to a different (possibly already-decided) game, and no
-- clearing your pick either. This closes a real exploit the old
-- week-level window allowed: waiting until early games are decided, then
-- quietly switching your pick to a known-safe result before the week
-- "closed" at a fixed calendar boundary.
--
-- Same trigger bindings as before (trg_lock_weekly_league_pick_i on
-- INSERT, trg_lock_weekly_league_pick_u on UPDATE/DELETE), only the
-- function body changes.
create or replace function public.lock_league_pick_at_week_close()
returns trigger
language plpgsql
as $function$
declare
  v_old_kickoff timestamptz;
  v_new_kickoff timestamptz;
begin
  -- Your existing pick's game must not have started yet, or you're locked
  -- in for the week (applies to both replacing and clearing a pick).
  if tg_op in ('UPDATE', 'DELETE') and old.game_id is not null then
    select kickoff_at into v_old_kickoff from public.games where id = old.game_id;
    if v_old_kickoff is not null and now() >= v_old_kickoff then
      raise exception 'This week''s pick is locked — your selected game has already started';
    end if;
  end if;

  -- The game you're picking (new or replacing into) must not have started yet.
  if tg_op in ('INSERT', 'UPDATE') and new.game_id is not null then
    select kickoff_at into v_new_kickoff from public.games where id = new.game_id;
    if v_new_kickoff is not null and now() >= v_new_kickoff then
      raise exception 'That game has already started — pick one that hasn''t kicked off yet';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;
