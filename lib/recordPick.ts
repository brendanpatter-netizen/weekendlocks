// lib/recordPick.ts
import { supabase } from "@/lib/supabase";

export type BetType = "spread" | "total" | "h2h";

type SavePickExtras = {
  groupId?: string;            // optional if saving solo
  league: "nfl" | "cfb";
  week: number;
};

/**
 * Minimal shape we need from your odds row. Your page already has these fields.
 */
type OddsPointPrice = {
  point?: number | null;
  price?: number | null;
};

type OddsGame = {
  id: string | number;          // your mapped game id
  name?: string;                // e.g., "CLE Browns -3.5 (-110)"
  o?: OddsPointPrice;           // selected market point/price
  label: string;                // team label you already compute (e.g., "Browns -3.5")
};

export async function savePick(
  oddsGame: OddsGame,
  type: BetType,
  extras: SavePickExtras
): Promise<true> {
  const { groupId, league, week } = extras;

  // who is saving?
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user?.id) {
    throw new Error("Not signed in.");
  }
  const userId = userRes.user.id;

  // build row
  const row = {
    user_id: userId,
    group_id: groupId ?? null,
    sport: league,                      // your table uses 'sport'
    week,
    game_id: String(oddsGame.id),
    pick_side: String(oddsGame.name ?? type),
    pick_line:
      oddsGame.o && oddsGame.o.point != null ? Number(oddsGame.o.point) : null,
    pick_price:
      oddsGame.o && typeof oddsGame.o.price === "number"
        ? oddsGame.o.price
        : null,
    pick_team: oddsGame.label,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  // upsert so same user can only have one pick per game per group
  const { error } = await supabase
    .from("picks")
    .upsert(row, {
      onConflict: "user_id,group_id,game_id",
    });

  if (error) throw error;

  return true;
}
