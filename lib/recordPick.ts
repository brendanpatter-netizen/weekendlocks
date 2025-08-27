import { supabase } from "@/lib/supabase";

type Sport = "nfl" | "cfb";

export async function recordPick(opts: {
  gameId: number;
  pickTeam: string;        // e.g. "PHI -6.5 (-110)" or "DAL ML"
  sport: Sport;            // "nfl" | "cfb"
  week: number;
  groupId?: string | null; // omit or null for solo/homepage
  market?: "spreads" | "totals" | "h2h";
  side?: string | null;    // "PHI" or "DAL", etc
  line?: number | null;    //  -6.5 / 50.5 / null
  price?: number | null;   //  -110 / +120 / null
}) {
  const { gameId, pickTeam, week, groupId, market, side, line, price } = opts;
  const sport = opts.sport.toLowerCase() as Sport;

  const { data: u } = await supabase.auth.getUser();
  const user_id = u.user?.id;
  if (!user_id) throw new Error("Sign in required");

  const row = {
    user_id,
    group_id: groupId ?? null,
    game_id: gameId,
    week,
    sport,
    pick_team: pickTeam,
    pick_market: market ?? null,
    pick_side: side ?? null,
    pick_line: line ?? null,
    pick_price: typeof price === "number" ? price : null,
    status: "pending" as const,
    created_at: new Date().toISOString(),
  };

  // Use the right conflict target based on solo vs group
  const conflict = groupId ? "user_id,group_id,game_id" : "user_id,game_id";
  const { error } = await supabase.from("picks").upsert(row, { onConflict: conflict });
  if (error) throw error;
}
