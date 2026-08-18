// components/WeeklyRecap.tsx
// The Tuesday-morning AI roast. api/generate-weekly-recaps.js (a Vercel Cron
// job) writes one row per member into weekly_recaps every Tuesday morning —
// this just reads the most recent week's rows for the group and displays
// them. Reloads whenever `refreshKey` changes, matching WeeklyPicksGrid.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import FlameIcon from "@/components/FlameIcon";
import TapeCorner from "@/components/TapeCorner";

type Recap = { user_id: string; display_name: string; recap_text: string; rank: number | null };
type Member = { user_id: string; display_name: string };

export default function WeeklyRecap({
  groupId, members, refreshKey,
}: { groupId: string; members: Member[]; refreshKey: number | string }) {
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [weekOf, setWeekOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("weekly_recaps")
        .select("user_id, week_of, recap_text, rank")
        .eq("group_id", groupId)
        .order("week_of", { ascending: false });
      if (!mounted) return;

      const latestWeek = data?.[0]?.week_of ?? null;
      const nameById = new Map(members.map((m) => [m.user_id, m.display_name]));
      // #1 first, descending from there.
      const rows = (data ?? [])
        .filter((r: any) => r.week_of === latestWeek)
        .sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0))
        .map((r: any) => ({
          user_id: r.user_id, recap_text: r.recap_text, rank: r.rank ?? null,
          display_name: nameById.get(r.user_id) ?? "Someone",
        }));

      setWeekOf(latestWeek);
      setRecaps(rows);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [groupId, refreshKey, members.length]);

  const weekOfLabel = weekOf
    ? new Date(`${weekOf}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <View style={styles.card}>
      <TapeCorner />
      <View style={styles.header}>
        <View style={styles.cardTitleRow}>
          <FlameIcon size={18} color="#B23A2E" />
          <Text style={styles.cardTitle}>Power Rankings</Text>
        </View>
        {weekOfLabel && <Text style={styles.weekLabel}>Week of {weekOfLabel}</Text>}
      </View>
      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : recaps.length === 0 ? (
        <Text style={styles.empty}>
          No recap yet — the bot roasts everyone every Tuesday morning once there's a week of picks to talk about.
        </Text>
      ) : (
        recaps.map((r, i) => (
          <View key={r.user_id} style={[styles.row, i === 0 && styles.rowFirst]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                {r.rank != null && (
                  <Text style={[styles.rankBadge, r.rank === 1 && styles.rankBadgeFirst]}>#{r.rank}</Text>
                )}
                <Text style={styles.name}>{r.display_name}</Text>
              </View>
              <Text style={styles.recapText}>{r.recap_text}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Per DESIGN.md's elevation direction, this card earns a soft shadow (the
  // product's actual differentiator, worth reading as a peak in the scroll)
  // rather than staying flat like the rest of the page — plus the same
  // paper-pinned-to-board language every card on the page now carries.
  // Square, not tilted — the tape corner alone carries the pinned feel.
  card: {
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed",
    borderRadius: 10, padding: 12, paddingTop: 16, gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 20, color: "#B23A2E" },
  weekLabel: { fontSize: 11, color: "#45564C", fontWeight: "700" },
  empty: { color: "#45564C", paddingVertical: 8 },
  row: {
    flexDirection: "row", gap: 10, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(12,23,18,0.15)",
  },
  rowFirst: { borderTopWidth: 0, paddingTop: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  rankBadge: {
    fontSize: 11, fontWeight: "800", color: "white", backgroundColor: "#0C1712",
    borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1,
  },
  // #1 gets circled in marker instead of a filled badge — the "coach
  // circled your name on the board" moment, the product's actual
  // differentiator getting the loudest treatment on the page. Straight,
  // not tilted — a crooked circle read as broken, not hand-marked.
  rankBadgeFirst: {
    backgroundColor: "transparent", color: "#B23A2E", borderWidth: 2, borderColor: "#B23A2E",
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  name: { fontWeight: "800", fontSize: 13, color: "#0C1712" },
  recapText: { fontSize: 13, color: "#2A362F", lineHeight: 19 },
});
