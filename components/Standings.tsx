// components/Standings.tsx
// The season leaderboard, merged with the "Bankroll" $ tracker (originally
// two separate cards) — a member's row now carries their record AND what
// their picks would have paid at a real sportsbook, $100 a lock, using the
// actual odds captured on each pick (picks.price). Record stays the
// primary rank (win% is what the group actually plays for); the $ total
// only breaks a tie, since several members tied on record is common and
// $ gives a cleaner, non-alphabetical tiebreak.
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { supabase } from "@/lib/supabase";
import { avatarColor } from "@/lib/avatar";
import { buildWeekRows, deriveSeason } from "@/lib/weekRows";
import { payout, formatMoney } from "@/lib/payout";
import { recordLabel, winPct, recordVibe, rankValue, type SeasonRecord } from "@/lib/records";
import DollarIcon from "@/components/DollarIcon";
import TrophyIcon from "@/components/TrophyIcon";
import TapeCorner from "@/components/TapeCorner";

type Member = { user_id: string; display_name: string; overall: SeasonRecord };
type Trajectory = { user_id: string; points: number[] }; // cumulative $ per row, 0..maxRow

const CHART_WIDTH = 280;
const CHART_HEIGHT = 110;
const CHART_PAD = 10;

export default function Standings({
  groupId, members, refreshKey,
}: { groupId: string; members: Member[]; refreshKey: number | string }) {
  const [totals, setTotals] = useState<Map<string, number>>(new Map());
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
      const nextTotals = new Map<string, number>();
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
    .sort((a, b) =>
      rankValue(b.overall) - rankValue(a.overall)
      || b.total - a.total
      || a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })
    );

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
      <TapeCorner />
      <View style={styles.titleRow}>
        <TrophyIcon size={18} color="#B23A2E" />
        <Text style={styles.cardTitle}>The Standings</Text>
      </View>

      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={styles.thRank}>#</Text>
        <Text style={styles.thUser}>Member</Text>
        <Text style={styles.thOverall}>Record</Text>
        <Text style={styles.thBankroll}>Bankroll</Text>
      </View>

      {members.length === 0 ? (
        <Text style={styles.empty}>No members yet.</Text>
      ) : (
        <FlatList
          data={ranked}
          keyExtractor={(m) => m.user_id}
          scrollEnabled={false}
          renderItem={({ item, index }) => {
            const overallRec = recordLabel(item.overall);
            const overallPct = winPct(item.overall);
            const vibe = recordVibe(item.overall);
            return (
              <View style={styles.tableRow}>
                <Text style={styles.rankText}>{index + 1}</Text>
                <View style={styles.userCell}>
                  <View style={[styles.swatch, { backgroundColor: avatarColor(item.user_id).fg }]} />
                  <Text style={styles.userName} numberOfLines={1}>{item.display_name}</Text>
                  {vibe && (
                    <View style={[styles.vibeChip, vibe.tone === "hot" ? styles.vibeChipHot : styles.vibeChipCold]}>
                      <Text style={[styles.vibeChipText, vibe.tone === "hot" ? styles.vibeChipTextHot : styles.vibeChipTextCold]}>
                        {vibe.label}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.overallCell}>
                  <Text style={styles.overallRecord}>{overallRec ?? "—"}</Text>
                  {overallPct && <Text style={styles.overallPct}>{overallPct}</Text>}
                </View>
                <Text style={[styles.bankrollCell, item.total >= 0 ? styles.up : styles.down]}>
                  {loading ? "…" : formatMoney(item.total)}
                </Text>
              </View>
            );
          }}
        />
      )}
      <Text style={styles.note}>Records update automatically as games finish — pushes count as a win.</Text>

      {!loading && maxRow > 1 && (
        <View style={styles.bankrollSection}>
          <View style={styles.bankrollHeader}>
            <DollarIcon size={13} color="#64748B" />
            <Text style={styles.bankrollHint}>
              $100 a lock, real sportsbook odds — hypothetical, nobody's actually betting.
            </Text>
          </View>
          <View style={styles.groupTotalRow}>
            <Text style={styles.groupTotalLabel}>Group total</Text>
            <Text style={[styles.groupTotalValue, groupTotal >= 0 ? styles.up : styles.down]}>
              {formatMoney(groupTotal)}
            </Text>
          </View>
          <View style={styles.chartOuter}>
          <View style={styles.chartWrap}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
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
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed",
    borderRadius: 10, padding: 12, paddingTop: 16, gap: 4, position: "relative",
  },
  cardElevated: {
    shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cardTitle: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 20, color: "#B23A2E" },
  empty: { paddingVertical: 8, color: "#64748B" },

  tableHeader: { paddingVertical: 6 },
  tableRow: {
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  thRank: { width: 22, fontWeight: "800", fontSize: 12, color: "#64748B" },
  thUser: { flex: 1.4, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase" },
  thOverall: { width: 64, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase", textAlign: "right" },
  thBankroll: { width: 68, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase", textAlign: "right" },

  rankText: { width: 22, fontWeight: "800", fontSize: 13, color: "#64748B" },
  userCell: { flex: 1.4, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  // Same identity color as the chart line below — the table doubles as the
  // chart's legend instead of needing a separate one.
  swatch: { width: 8, height: 8, borderRadius: 999 },
  userName: { fontWeight: "700", flexShrink: 1 },
  // Same dashed hand-marked pill language as waitingBanner/inviteRow, just
  // sized as an inline chip next to a name — ink color is the only thing
  // that changes between "hot" and "cold" (see The Two-Voice Rule), no
  // emoji, matching how every other icon in the product is hand-authored
  // rather than borrowed from the system font's emoji set.
  vibeChip: {
    borderWidth: 1.5, borderStyle: "dashed", borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 2,
  },
  vibeChipHot: { borderColor: "#B23A2E", backgroundColor: "rgba(178,58,46,0.08)" },
  vibeChipCold: { borderColor: "#0B735F", backgroundColor: "rgba(11,115,95,0.08)" },
  vibeChipText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  vibeChipTextHot: { color: "#B23A2E" },
  vibeChipTextCold: { color: "#0B735F" },

  overallCell: { width: 64, alignItems: "flex-end" },
  overallRecord: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  overallPct: { fontSize: 11, color: "#64748B" },
  bankrollCell: { width: 68, fontSize: 13, fontWeight: "800", textAlign: "right" },

  note: { marginTop: 8, color: "#64748B", fontSize: 12 },

  bankrollSection: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(12,23,18,0.12)", gap: 6,
  },
  bankrollHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  bankrollHint: { flex: 1, fontSize: 11, color: "#64748B" },
  groupTotalRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  groupTotalLabel: { fontSize: 13, fontWeight: "700", color: "#45564C" },
  groupTotalValue: { fontSize: 20, fontWeight: "800" },
  // Capped and centered — on a wide desktop card, an uncapped 100%-width
  // chart blows up to the full card width (and, since chartWrap below
  // forces the same aspect ratio, just as tall), which reads as a giant
  // smear rather than a readable sparkline. 360px is plenty to show the
  // season's shape at a glance.
  chartOuter: { width: "100%", maxWidth: 360, alignSelf: "center" },
  // The View, not the Svg, owns the aspect ratio — forcing the Svg's own
  // width/height to always match its viewBox exactly, so there's no
  // width/height-vs-viewBox mismatch for react-native-svg to resolve by
  // stretching the two axes unevenly (the cause of a real bug here once:
  // a fixed pixel height against a percentage width badly distorted the
  // line chart at real card widths).
  chartWrap: { width: "100%", aspectRatio: CHART_WIDTH / CHART_HEIGHT },

  up: { color: "#166534" },
  down: { color: "#991B1B" },
});
