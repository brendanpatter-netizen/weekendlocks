// components/WeeklyPicksGrid.tsx
// A season-long tracker: one row per week, one NCAA/NFL column pair per
// member, colored by result — mirroring the spreadsheet this group used
// before the app existed. Reloads whenever `refreshKey` changes, which the
// dashboard bumps after every load and after "Refresh scores".
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { avatarColor } from "@/lib/avatar";
import { pickLabel } from "@/lib/pickLabel";
import { recordLabel, winPct, EMPTY_RECORD, type SeasonRecord } from "@/lib/records";

type Result = "win" | "loss" | "push" | null;
type Cell = { label: string | null; result: Result };
type Member = { user_id: string; display_name: string };

const WEEK_COL_WIDTH = 56;
const PICK_COL_WIDTH = 152;

function cellKey(userId: string, sport: "nfl" | "cfb", week: number, slot: number) {
  return `${userId}|${sport}|${week}|${slot}`;
}

export default function WeeklyPicksGrid({
  groupId, members, weekCount, refreshKey,
}: { groupId: string; members: Member[]; weekCount: number; refreshKey: number | string }) {
  const [grid, setGrid] = useState<Map<string, Cell>>(new Map());
  const [overall, setOverall] = useState<Map<string, SeasonRecord>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data: picks }, { data: results }] = await Promise.all([
        supabase.from("picks").select("id, user_id, sport, week, slot, market, team, line").eq("group_id", groupId),
        supabase.from("pick_results").select("pick_id, result").eq("group_id", groupId),
      ]);
      if (!mounted) return;

      const resultByPickId = new Map<string, Result>((results ?? []).map((r: any) => [r.pick_id, r.result]));
      const map = new Map<string, Cell>();
      const recordAcc = new Map<string, SeasonRecord>();

      (picks ?? []).forEach((p: any) => {
        const result = resultByPickId.get(p.id) ?? null;
        map.set(cellKey(p.user_id, p.sport, p.week, p.slot ?? 1), { label: pickLabel(p), result });
        if (result) {
          const cur = recordAcc.get(p.user_id) ?? { ...EMPTY_RECORD };
          if (result === "loss") cur.losses += 1;
          else cur.wins += 1; // win or push — push counts as a win
          recordAcc.set(p.user_id, cur);
        }
      });

      setGrid(map);
      setOverall(recordAcc);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [groupId, refreshKey]);

  const weeks = Array.from({ length: weekCount }, (_, i) => i + 1);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>🔒 Weekend Locks</Text>
        <View style={styles.legend}>
          <View style={[styles.legendDot, styles.cellWin]} /><Text style={styles.legendText}>Win</Text>
          <View style={[styles.legendDot, styles.cellLoss]} /><Text style={styles.legendText}>Loss</Text>
          <View style={[styles.legendDot, styles.cellPending]} /><Text style={styles.legendText}>Pending</Text>
        </View>
      </View>

      {members.length === 0 ? (
        <Text style={styles.empty}>No members yet.</Text>
      ) : loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 8 }}>
          <View>
            {/* Member name header, spanning that member's two sub-columns */}
            <View style={styles.row}>
              <View style={styles.weekHeadCell} />
              {members.map((m) => {
                const color = avatarColor(m.user_id);
                return (
                  <View key={m.user_id} style={[styles.memberHeadCell, { backgroundColor: color.bg }]}>
                    <Text style={[styles.memberHeadText, { color: color.fg }]} numberOfLines={1}>{m.display_name}</Text>
                  </View>
                );
              })}
            </View>
            {/* NCAA / NFL sub-header */}
            <View style={styles.row}>
              <View style={styles.weekHeadCell} />
              {members.map((m) => (
                <View key={m.user_id} style={{ flexDirection: "row" }}>
                  <View style={styles.subHeadCell}><Text style={styles.subHeadText}>NCAA</Text></View>
                  <View style={styles.subHeadCell}><Text style={styles.subHeadText}>NFL</Text></View>
                </View>
              ))}
            </View>

            {weeks.map((week) => (
              <View key={week} style={[styles.row, styles.dataRow]}>
                {/* Display-only: the grid's row label starts at 0, but `week`
                    itself (used for all the data lookups below) still matches
                    the real week number everywhere else in the app. */}
                <View style={styles.weekCell}><Text style={styles.weekCellText}>Wk {week - 1}</Text></View>
                {members.map((m) => {
                  const cfb = grid.get(cellKey(m.user_id, "cfb", week, 1));
                  const nfl = grid.get(cellKey(m.user_id, "nfl", week, 1));
                  // Weeks before the NFL season opens have no NFL pick to show —
                  // fall back to a second CFB lock in that slot instead (the
                  // "2 picks a week" gap-week rule from the picks page).
                  const cfbLock2 = grid.get(cellKey(m.user_id, "cfb", week, 2));
                  const secondCell = nfl ?? cfbLock2;
                  return (
                    <View key={m.user_id} style={{ flexDirection: "row" }}>
                      <PickCell cell={cfb} />
                      <PickCell cell={secondCell} isSecondCfbLock={!nfl && !!cfbLock2} />
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Combined (NCAA + NFL) season record per member */}
            <View style={[styles.row, styles.overallRow]}>
              <View style={styles.weekCell}><Text style={styles.overallLabel}>Overall</Text></View>
              {members.map((m) => {
                const rec = overall.get(m.user_id) ?? EMPTY_RECORD;
                const label = recordLabel(rec);
                const pct = winPct(rec);
                return (
                  <View key={m.user_id} style={styles.overallCell}>
                    <Text style={styles.overallRecordText}>{label ?? "—"}</Text>
                    {pct && <Text style={styles.overallPctText}>{pct}</Text>}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function PickCell({ cell, isSecondCfbLock }: { cell?: Cell; isSecondCfbLock?: boolean }) {
  if (!cell || !cell.label) {
    return <View style={[styles.pickCell, styles.cellEmpty]}><Text style={styles.cellEmptyText}>—</Text></View>;
  }
  const resultStyle = cell.result === "loss" ? styles.cellLoss : cell.result ? styles.cellWin : styles.cellPending;
  return (
    <View style={[styles.pickCell, resultStyle]}>
      {isSecondCfbLock && (
        <View style={styles.secondLockBadge}><Text style={styles.secondLockBadgeText}>2</Text></View>
      )}
      <Text style={styles.cellText}>{cell.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 4 },
  cardTitle: { fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  legend: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 999 },
  legendText: { fontSize: 11, color: "#64748B", fontWeight: "600", marginRight: 6 },
  empty: { paddingVertical: 8, color: "#64748B" },

  row: { flexDirection: "row" },
  dataRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB" },
  overallRow: { borderTopWidth: 1, borderTopColor: "#CBD5E1" },

  weekHeadCell: { width: WEEK_COL_WIDTH },
  weekCell: { width: WEEK_COL_WIDTH, justifyContent: "center", paddingVertical: 8, paddingRight: 6 },
  weekCellText: { fontSize: 12, fontWeight: "700", color: "#64748B" },

  memberHeadCell: {
    width: PICK_COL_WIDTH * 2, alignItems: "center", justifyContent: "center",
    paddingVertical: 6, borderTopLeftRadius: 8, borderTopRightRadius: 8, marginLeft: 1,
  },
  memberHeadText: { fontWeight: "800", fontSize: 13 },

  subHeadCell: { width: PICK_COL_WIDTH, alignItems: "center", paddingVertical: 4, backgroundColor: "#F8FAFC" },
  subHeadText: { fontSize: 10, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 }, // was #94A3B8 (2.56:1) — failed WCAG AA

  pickCell: {
    width: PICK_COL_WIDTH - 2, marginLeft: 1, marginVertical: 1, borderRadius: 6,
    paddingVertical: 7, paddingHorizontal: 8, justifyContent: "center", alignItems: "center",
    position: "relative",
  },
  cellText: { fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 14 },
  secondLockBadge: {
    position: "absolute", top: 2, right: 2, width: 13, height: 13, borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.35)", alignItems: "center", justifyContent: "center",
  },
  secondLockBadgeText: { fontSize: 8, fontWeight: "800", color: "white" },
  cellWin: { backgroundColor: "#DCFCE7" },
  cellLoss: { backgroundColor: "#FEE2E2" },
  cellPending: { backgroundColor: "#F1F5F9" },
  cellEmpty: { backgroundColor: "transparent" },
  cellEmptyText: { fontSize: 12, color: "#CBD5E1" },

  overallCell: { width: PICK_COL_WIDTH * 2, alignItems: "center", justifyContent: "center", paddingVertical: 8, marginLeft: 1 },
  overallLabel: { fontSize: 12, fontWeight: "800", color: "#0F172A" },
  overallRecordText: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  overallPctText: { fontSize: 11, color: "#64748B" },
});
