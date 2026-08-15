// components/WeeklyRecap.tsx
// The Tuesday-morning AI roast. api/generate-weekly-recaps.js (a Vercel Cron
// job) writes one row per member into weekly_recaps every Tuesday morning —
// this just reads the most recent week's rows for the group and displays
// them. Reloads whenever `refreshKey` changes, matching WeeklyPicksGrid.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { avatarColor, initials } from "@/lib/avatar";

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
      // Countdown order — worst record first, building up to the leader.
      const rows = (data ?? [])
        .filter((r: any) => r.week_of === latestWeek)
        .sort((a: any, b: any) => (b.rank ?? 0) - (a.rank ?? 0))
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
      <View style={styles.header}>
        <Text style={styles.cardTitle}>🔥 Power Rankings</Text>
        {weekOfLabel && <Text style={styles.weekLabel}>Week of {weekOfLabel}</Text>}
      </View>
      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : recaps.length === 0 ? (
        <Text style={styles.empty}>
          No recap yet — the bot roasts everyone every Tuesday morning once there's a week of picks to talk about.
        </Text>
      ) : (
        recaps.map((r, i) => {
          const color = avatarColor(r.user_id);
          return (
            <View key={r.user_id} style={[styles.row, i === 0 && styles.rowFirst]}>
              <View style={[styles.avatar, { backgroundColor: color.bg }]}>
                <Text style={[styles.avatarText, { color: color.fg }]}>{initials(r.display_name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                  {r.rank != null && <Text style={styles.rankBadge}>#{r.rank}</Text>}
                  <Text style={styles.name}>{r.display_name}</Text>
                </View>
                <Text style={styles.recapText}>{r.recap_text}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontWeight: "800" },
  weekLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "700" },
  empty: { color: "#64748B", paddingVertical: 8 },
  row: {
    flexDirection: "row", gap: 10, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
  },
  rowFirst: { borderTopWidth: 0, paddingTop: 8 },
  avatar: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  rankBadge: {
    fontSize: 11, fontWeight: "800", color: "white", backgroundColor: "#0F172A",
    borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1,
  },
  name: { fontWeight: "800", fontSize: 13, color: "#0F172A" },
  recapText: { fontSize: 13, color: "#334155", lineHeight: 19 },
});
