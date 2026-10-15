// components/Bankroll.tsx
// "If this had been a real $100-a-lock bet" tracker — every graded pick's
// actual American odds (picks.price) against a fixed $100 stake, summed
// per member and for the group as a whole, plotted as a cumulative line
// per member across the season (the "stock market" framing). Explicitly
// notional — see the hint text — this product has never carried real
// money and isn't starting now; the payout math exists purely so the
// bragging rights have a dollar figure attached.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { supabase } from "@/lib/supabase";
import { avatarColor } from "@/lib/avatar";
import { buildWeekRows, deriveSeason } from "@/lib/weekRows";
import { payout, formatMoney } from "@/lib/payout";
import DollarIcon from "@/components/DollarIcon";
import TapeCorner from "@/components/TapeCorner";

type Member = { user_id: string; display_name: string };
type Totals = Map<string, number>; // user_id -> current $ total
type Trajectory = { user_id: string; points: number[] }; // cumulative $ per row, 0..maxRow

const CHART_WIDTH = 280;
const CHART_HEIGHT = 120;
const CHART_PAD = 10;

export default function Bankroll({
  groupId, members, refreshKey,
}: { groupId: string; members: Member[]; refreshKey: number | string }) {
  const [totals, setTotals] = useState<Totals>(new Map());
  const [trajectories, setTrajectories] = useState<Trajectory[]>([]);
  const [maxRow, setMaxRow] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data: picks }, { data: results }] = await Promise.all([
        supabase.from("picks").select("id, user_id, sport, week, price, game_id").eq("group_id", groupId),
        supabase.from("pick_results").select("pick_id, result").eq("group_id", groupId),
      ]);
      if (!mounted) return;

      const gameIds = Array.from(new Set((picks ?? []).map((p: any) => p.game_id).filter(Boolean)));
      const { data: games } = gameIds.length
        ? await supabase.from("games").select("id, week_id").in("id", gameIds)
        : { data: [] as any[] };
      if (!mounted) return;

      const weekIds = Array.from(new Set((games ?? []).map((g: any) => g.week_id).filter(Boolean)));
      const { data: pickWeeksRows } = weekIds.length
        ? await supabase.from("weeks").select("season").in("id", weekIds)
        : { data: [] as any[] };
      const season = deriveSeason((pickWeeksRows ?? []) as any[]);

      const { data: weeksData } = await supabase
        .from("weeks").select("league, week_num, opens_at").eq("season", season).in("league", ["nfl", "cfb"]);
      if (!mounted) return;
      const { rowForWeekNum } = buildWeekRows((weeksData ?? []) as any[]);

      const resultByPickId = new Map<string, "win" | "loss" | "push" | null>(
        (results ?? []).map((r: any) => [r.pick_id, r.result])
      );

      // Net $ per (member, row) — a member can have up to two locks in a
      // gap week (two CFB slots), so this sums rather than overwrites.
      const netByMemberRow = new Map<string, number>(); // key: `${user_id}|${row}`
      let highestGradedRow = -1;
      (picks ?? []).forEach((p: any) => {
        const row = rowForWeekNum.get(`${p.sport}|${p.week}`);
        if (row == null) return;
        const result = resultByPickId.get(p.id) ?? null;
        if (result != null) highestGradedRow = Math.max(highestGradedRow, row);
        const amount = payout(p.price, result);
        const key = `${p.user_id}|${row}`;
        netByMemberRow.set(key, (netByMemberRow.get(key) ?? 0) + amount);
      });

      const plotRows = Math.max(highestGradedRow + 1, 0);
      const nextTotals: Totals = new Map();
      const nextTrajectories: Trajectory[] = [];
      members.forEach((m) => {
        const points: number[] = [];
        let running = 0;
        for (let row = 0; row < plotRows; row++) {
          running += netByMemberRow.get(`${m.user_id}|${row}`) ?? 0;
          points.push(running);
        }
        nextTotals.set(m.user_id, running);
        nextTrajectories.push({ user_id: m.user_id, points });
      });

      setTotals(nextTotals);
      setTrajectories(nextTrajectories);
      setMaxRow(plotRows);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [groupId, refreshKey, members.map((m) => m.user_id).join(",")]);

  const groupTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  const ranked = members
    .map((m) => ({ ...m, total: totals.get(m.user_id) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  // Y-scale across every member's full trajectory, zero always included so
  // the breakeven line is always on the chart.
  const allValues = trajectories.flatMap((t) => t.points);
  const minV = Math.min(0, ...allValues);
  const maxV = Math.max(0, ...allValues);
  const span = maxV - minV || 1;
  const plotW = CHART_WIDTH - CHART_PAD * 2;
  const plotH = CHART_HEIGHT - CHART_PAD * 2;
  const xFor = (row: number) => CHART_PAD + (maxRow > 1 ? (row / (maxRow - 1)) * plotW : plotW / 2);
  const yFor = (v: number) => CHART_PAD + plotH - ((v - minV) / span) * plotH;
  const zeroY = yFor(0);

  return (
    <View style={[styles.card, styles.cardElevated]}>
      <TapeCorner side="right" />
      <View style={styles.titleRow}>
        <DollarIcon size={18} color="#B23A2E" />
        <Text style={styles.cardTitle}>Bankroll</Text>
      </View>
      <Text style={styles.hint}>$100 a lock, real sportsbook odds — hypothetical, nobody's actually betting.</Text>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : members.length === 0 ? (
        <Text style={styles.empty}>No members yet.</Text>
      ) : (
        <>
          <View style={styles.groupTotalRow}>
            <Text style={styles.groupTotalLabel}>Group total</Text>
            <Text style={[styles.groupTotalValue, groupTotal >= 0 ? styles.up : styles.down]}>
              {formatMoney(groupTotal)}
            </Text>
          </View>

          {maxRow > 1 && (
            <View style={styles.chartWrap}>
              <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
                <Line
                  x1={CHART_PAD} y1={zeroY} x2={CHART_WIDTH - CHART_PAD} y2={zeroY}
                  stroke="rgba(12,23,18,0.2)" strokeWidth={1} strokeDasharray="3,3"
                />
                {trajectories.map((t) => (
                  <Polyline
                    key={t.user_id}
                    points={t.points.map((v, row) => `${xFor(row)},${yFor(v)}`).join(" ")}
                    fill="none"
                    stroke={avatarColor(t.user_id).fg}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </Svg>
            </View>
          )}

          <View style={styles.list}>
            {ranked.map((m, i) => (
              <View key={m.user_id} style={styles.row}>
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={[styles.swatch, { backgroundColor: avatarColor(m.user_id).fg }]} />
                <Text style={styles.name} numberOfLines={1}>{m.display_name}</Text>
                <Text style={[styles.amount, m.total >= 0 ? styles.up : styles.down]}>
                  {formatMoney(m.total)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed",
    borderRadius: 10, padding: 12, paddingTop: 16, gap: 8, position: "relative",
  },
  cardElevated: {
    shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 20, color: "#B23A2E" },
  hint: { fontSize: 11, color: "#64748B" },
  empty: { paddingVertical: 8, color: "#64748B" },

  groupTotalRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  groupTotalLabel: { fontSize: 13, fontWeight: "700", color: "#45564C" },
  groupTotalValue: { fontSize: 22, fontWeight: "800" },

  chartWrap: { marginTop: 2 },

  list: { gap: 2, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB" },
  rank: { width: 16, fontSize: 12, fontWeight: "800", color: "#64748B" },
  swatch: { width: 8, height: 8, borderRadius: 999 },
  name: { flex: 1, fontSize: 13, fontWeight: "700", color: "#0C1712" },
  amount: { fontSize: 14, fontWeight: "800" },
  up: { color: "#166534" },
  down: { color: "#991B1B" },
});
