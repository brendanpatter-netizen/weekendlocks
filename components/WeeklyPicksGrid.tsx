// components/WeeklyPicksGrid.tsx
// A season-long tracker: one row per week, one NCAA/NFL column pair per
// member, colored by result — mirroring the spreadsheet this group used
// before the app existed. Reloads whenever `refreshKey` changes, which the
// dashboard bumps after every load and after "Refresh scores".
import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { pickLabel, matchupSuffix } from "@/lib/pickLabel";
import { recordLabel, winPct, EMPTY_RECORD, type SeasonRecord } from "@/lib/records";
import { logoUri } from "@/lib/teamLogos";
import LockIcon from "@/components/LockIcon";
import TapeCorner from "@/components/TapeCorner";

function getTeamLogo(name: string | null | undefined, sport: "nfl" | "cfb"): string | null {
  if (!name) return null;
  const uri = logoUri(name, sport === "nfl" ? "nfl" : "ncaaf");
  return uri === "about:blank" ? null : uri;
}

type Result = "win" | "loss" | "push" | null;
type GameInfo = { home: string; away: string; home_score: number | null; away_score: number | null; status: string };
type Cell = {
  label: string | null; result: Result;
  pick: { sport: "nfl" | "cfb"; market: string; team: string | null; line: string | null } | null;
  game: GameInfo | null;
};
type Member = { user_id: string; display_name: string };
type OpenCell = { memberName: string; weekLabel: string; cell: Cell };

const WEEK_COL_WIDTH = 56;
const PICK_COL_WIDTH = 152;

function cellKey(userId: string, sport: "nfl" | "cfb", row: number, slot: number) {
  return `${userId}|${sport}|${row}|${slot}`;
}

// NFL and CFB number their own weeks independently — CFB starts about two
// weeks earlier with its own "Week 0" slate, so week_num=1 for one sport
// isn't the same real week as week_num=1 for the other (that mismatch used
// to let a stale pre-season CFB gap-week pick collide with, and hide, a
// brand-new NFL pick that happened to share the same raw week number).
// The only thing that actually identifies "the same real week" across both
// sports is a shared kickoff window, so rows are built from each league's
// own weeks.opens_at rather than from week_num directly: every distinct
// opens_at across both leagues gets one row, and a week from either sport
// lands in the row whose date it shares — naturally landing NFL's Week 1
// in the same row as CFB's Week 2, since both open the same day.
//
// Grouped by proximity rather than exact equality: a week row can get
// auto-created from a live schedule sync (ensure_week_row, keyed off one
// game's kickoff) instead of the clean seed migration, which can leave its
// opens_at a few hours or days off the aligned boundary the other league
// uses for the same real week (this happened once — see the 2026-09-16
// migration). Exact-match grouping would silently split that week into its
// own row instead of merging it; two real distinct weeks are always ~7 days
// apart, so a tolerance well under that only ever absorbs that kind of
// drift, never merges genuinely different weeks.
const ROW_GROUP_TOLERANCE_MS = 3 * 24 * 60 * 60 * 1000;
function buildWeekRows(weeksData: { league: string; week_num: number; opens_at: string }[]) {
  const sortedOpensAt = Array.from(new Set(weeksData.map((w) => w.opens_at))).sort();
  const rowForOpensAt = new Map<string, number>();
  let rowIndex = -1;
  let rowAnchorMs = -Infinity;
  for (const d of sortedOpensAt) {
    const t = new Date(d).getTime();
    if (t - rowAnchorMs > ROW_GROUP_TOLERANCE_MS) {
      rowIndex++;
      rowAnchorMs = t;
    }
    rowForOpensAt.set(d, rowIndex);
  }
  const rowForWeekNum = new Map<string, number>(); // key: `${league}|${week_num}`
  weeksData.forEach((w) => {
    const row = rowForOpensAt.get(w.opens_at);
    if (row != null) rowForWeekNum.set(`${w.league}|${w.week_num}`, row);
  });
  return { rowCount: rowIndex + 1, rowForWeekNum };
}

function cellLabel(p: { market: string; team: string | null; line: string | null }, game?: { home: string; away: string }): string | null {
  const base = pickLabel(p);
  if (!base) return null;
  const suffix = matchupSuffix(p.market, game);
  return suffix ? `${base}\n${suffix}` : base;
}

export default function WeeklyPicksGrid({
  groupId, members, refreshKey,
}: { groupId: string; members: Member[]; refreshKey: number | string }) {
  const [grid, setGrid] = useState<Map<string, Cell>>(new Map());
  const [overall, setOverall] = useState<Map<string, SeasonRecord>>(new Map());
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openCell, setOpenCell] = useState<OpenCell | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data: picks }, { data: results }] = await Promise.all([
        supabase.from("picks").select("id, user_id, sport, week, slot, market, team, line, game_id").eq("group_id", groupId),
        supabase.from("pick_results").select("pick_id, result").eq("group_id", groupId),
      ]);
      if (!mounted) return;

      const gameIds = Array.from(new Set((picks ?? []).map((p: any) => p.game_id).filter(Boolean)));
      const { data: games } = gameIds.length
        ? await supabase.from("games").select("id, home, away, week_id, home_score, away_score, status").in("id", gameIds)
        : { data: [] as any[] };
      if (!mounted) return;
      const gameById = new Map((games ?? []).map((g: any) => [g.id, g]));

      // weeks holds every season this app has ever seeded (test 2025 data
      // included) — merging opens_at across seasons would scatter rows
      // across a year of unrelated dates instead of one clean sequence for
      // the season actually in play. Derive that season from the real
      // games this group's picks reference; fall back to the current
      // calendar year for a brand-new group with no picks yet, so the full
      // season skeleton still renders before anyone's picked.
      const weekIds = Array.from(new Set((games ?? []).map((g: any) => g.week_id).filter(Boolean)));
      const { data: pickWeeksRows } = weekIds.length
        ? await supabase.from("weeks").select("season").in("id", weekIds)
        : { data: [] as any[] };
      const seasons = Array.from(new Set((pickWeeksRows ?? []).map((w: any) => w.season)));
      const season = seasons.length ? Math.max(...seasons) : new Date().getFullYear();

      const { data: weeksData } = await supabase
        .from("weeks").select("league, week_num, opens_at").eq("season", season).in("league", ["nfl", "cfb"]);
      if (!mounted) return;
      const { rowCount: rc, rowForWeekNum } = buildWeekRows((weeksData ?? []) as any[]);

      const resultByPickId = new Map<string, Result>((results ?? []).map((r: any) => [r.pick_id, r.result]));
      const map = new Map<string, Cell>();
      const recordAcc = new Map<string, SeasonRecord>();

      (picks ?? []).forEach((p: any) => {
        const row = rowForWeekNum.get(`${p.sport}|${p.week}`);
        if (row == null) return; // no matching weeks row (shouldn't happen with real data) — nothing sane to show it under
        const result = resultByPickId.get(p.id) ?? null;
        const game = gameById.get(p.game_id) ?? null;
        const label = cellLabel(p, game);
        map.set(cellKey(p.user_id, p.sport, row, p.slot ?? 1), {
          label, result,
          pick: { sport: p.sport, market: p.market, team: p.team, line: p.line },
          game: game ? { home: game.home, away: game.away, home_score: game.home_score, away_score: game.away_score, status: game.status } : null,
        });
        if (result) {
          const cur = recordAcc.get(p.user_id) ?? { ...EMPTY_RECORD };
          if (result === "loss") cur.losses += 1;
          else cur.wins += 1; // win or push — push counts as a win
          recordAcc.set(p.user_id, cur);
        }
      });

      setGrid(map);
      setOverall(recordAcc);
      setRowCount(rc);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [groupId, refreshKey]);

  const weeks = Array.from({ length: rowCount }, (_, i) => i);

  return (
    <View style={styles.card}>
      <TapeCorner side="right" />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <LockIcon size={17} color="#B23A2E" />
          <Text style={styles.cardTitle}>Weekend Locks</Text>
        </View>
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
              {members.map((m) => (
                <View key={m.user_id} style={styles.memberHeadCell}>
                  <Text style={styles.memberHeadText} numberOfLines={1}>{m.display_name}</Text>
                </View>
              ))}
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

            {weeks.map((row) => (
              <View key={row} style={[styles.row, styles.dataRow]}>
                {/* row is already a real-calendar-week index (see
                    buildWeekRows) — CFB "owns" the numbering since it starts
                    the timeline with its own Week 0, so this lines up with
                    CFB's own displayed week number for every row CFB plays,
                    and simply keeps counting for any NFL-only rows after
                    CFB's season ends. */}
                <View style={styles.weekCell}><Text style={styles.weekCellText}>Wk {row}</Text></View>
                {members.map((m) => {
                  const cfb = grid.get(cellKey(m.user_id, "cfb", row, 1));
                  const nfl = grid.get(cellKey(m.user_id, "nfl", row, 1));
                  // The gap-week 2nd CFB lock (see isGapWeek in college.tsx)
                  // only ever gets made for a row that has no concurrent NFL
                  // week yet, so nfl and cfbLock2 should never both be set
                  // for the same row now that rows are matched by real
                  // calendar date rather than by raw week_num coincidence —
                  // ?? here is just a defensive fallback, not load-bearing.
                  const cfbLock2 = grid.get(cellKey(m.user_id, "cfb", row, 2));
                  const secondCell = nfl ?? cfbLock2;
                  const showingCfbLock2 = !nfl && !!cfbLock2;
                  const weekLabel = `Wk ${row}`;
                  return (
                    <View key={m.user_id} style={{ flexDirection: "row" }}>
                      <PickCell cell={cfb} onOpen={() => cfb && setOpenCell({ memberName: m.display_name, weekLabel, cell: cfb })} />
                      <PickCell cell={secondCell} isSecondCfbLock={showingCfbLock2} onOpen={() => secondCell && setOpenCell({ memberName: m.display_name, weekLabel, cell: secondCell })} />
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
      <ScorePunchOut open={openCell} onClose={() => setOpenCell(null)} />
    </View>
  );
}

function PickCell({ cell, isSecondCfbLock, onOpen }: { cell?: Cell; isSecondCfbLock?: boolean; onOpen: () => void }) {
  if (!cell || !cell.label) {
    return <View style={[styles.pickCell, styles.cellEmpty]}><Text style={styles.cellEmptyText}>—</Text></View>;
  }
  const resultStyle = cell.result === "loss" ? styles.cellLoss : cell.result ? styles.cellWin : styles.cellPending;
  // Only a graded (final) game has a score worth punching out to show —
  // a pending pick's cell just isn't tappable yet.
  const isFinal = cell.game?.status === "final";
  return (
    <Pressable
      disabled={!isFinal}
      onPress={onOpen}
      style={({ pressed }) => [styles.pickCell, resultStyle, isFinal && pressed && styles.pickCellPressed]}
      hitSlop={4}
    >
      {isSecondCfbLock && (
        <View style={styles.secondLockBadge}><Text style={styles.secondLockBadgeText}>2</Text></View>
      )}
      <Text style={styles.cellText}>{cell.label}</Text>
    </Pressable>
  );
}

function ScoreboardTeamRow({
  name, score, logo, isWinner,
}: { name: string; score: number | null; logo: string | null; isWinner: boolean }) {
  return (
    <View style={styles.sbTeamRow}>
      {logo ? (
        <View style={styles.sbLogoWrap}><Image source={{ uri: logo }} style={styles.sbLogo} resizeMode="contain" /></View>
      ) : (
        <View style={styles.sbLogoPlaceholder} />
      )}
      <Text style={[styles.sbTeamName, isWinner && styles.sbTeamNameWinner]} numberOfLines={1}>{name}</Text>
      <Text style={[styles.sbScore, isWinner && styles.sbScoreWinner]}>{score ?? "–"}</Text>
    </View>
  );
}

function ScorePunchOut({ open, onClose }: { open: OpenCell | null; onClose: () => void }) {
  if (!open) return null;
  const { memberName, weekLabel, cell } = open;
  const game = cell.game;
  const pickText = cell.pick ? pickLabel(cell.pick) : null;
  const resultLabel = cell.result === "win" ? "Won" : cell.result === "loss" ? "Lost" : cell.result === "push" ? "Push" : null;
  const sport = cell.pick?.sport ?? "nfl";
  const homeWon = !!game && game.home_score != null && game.away_score != null && game.home_score > game.away_score;
  const awayWon = !!game && game.home_score != null && game.away_score != null && game.away_score > game.home_score;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <TapeCorner />
          <Text style={styles.modalEyebrow}>{memberName} · {weekLabel}</Text>
          {game && (
            <View style={styles.scoreboard}>
              <View style={styles.sbFinalTag}><Text style={styles.sbFinalTagText}>Final</Text></View>
              <ScoreboardTeamRow
                name={game.away} score={game.away_score} isWinner={awayWon}
                logo={getTeamLogo(game.away, sport)}
              />
              <View style={styles.sbDivider} />
              <ScoreboardTeamRow
                name={game.home} score={game.home_score} isWinner={homeWon}
                logo={getTeamLogo(game.home, sport)}
              />
            </View>
          )}
          {pickText && (
            <Text style={styles.modalPickText}>
              Pick: <Text style={styles.modalPickTextBold}>{pickText}</Text>
              {cell.pick?.market === "totals" && game ? ` (${game.away} @ ${game.home})` : ""}
            </Text>
          )}
          {resultLabel && (
            <Text style={[
              styles.modalResult,
              cell.result === "win" && styles.modalResultWin,
              cell.result === "loss" && styles.modalResultLoss,
            ]}>
              {resultLabel}
            </Text>
          )}
          <Pressable style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed",
    borderRadius: 10, padding: 12, paddingTop: 16, gap: 4,
  },
  cardTitle: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 20, color: "#B23A2E" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
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
    backgroundColor: "#E2E8F0",
  },
  memberHeadText: { fontWeight: "800", fontSize: 13, color: "#0F172A" },

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
  pickCellPressed: { opacity: 0.6 },

  overallCell: { width: PICK_COL_WIDTH * 2, alignItems: "center", justifyContent: "center", paddingVertical: 8, marginLeft: 1 },
  overallLabel: { fontSize: 12, fontWeight: "800", color: "#0F172A" },
  overallRecordText: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  overallPctText: { fontSize: 11, color: "#64748B" },

  // The "punch out" — a chalk-paper card matching the group dashboard's own
  // modal-less card language, just centered over a dimmed backdrop instead
  // of living in the page flow.
  modalBackdrop: { flex: 1, backgroundColor: "rgba(6,20,15,0.55)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: {
    position: "relative", width: "100%", maxWidth: 320, backgroundColor: "#F5F3E7",
    borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed",
    borderRadius: 12, padding: 18, gap: 10,
  },
  modalEyebrow: { fontSize: 11, fontWeight: "800", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 },

  // The scoreboard panel — a dark "under the lights" inset inside the
  // otherwise light chalk-paper card, since the actual point here is the
  // score, not another sheet of paper. Winner's row gets brass/gold, same
  // "special" color the rest of the product reserves for a standout value
  // (the leader's name on the groups list, the OTP pill) rather than a new
  // color meaning "won" only here.
  scoreboard: {
    position: "relative", backgroundColor: "#0A2620", borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 14, gap: 8,
  },
  sbFinalTag: {
    position: "absolute", top: -8, left: 12, backgroundColor: "#0A2620",
    borderWidth: 1, borderColor: "rgba(242,194,102,0.5)", borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  sbFinalTagText: { fontSize: 9, fontWeight: "800", color: "#F2C266", textTransform: "uppercase", letterSpacing: 0.6 },
  sbTeamRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sbLogoWrap: {
    width: 22, height: 22, borderRadius: 999, backgroundColor: "white",
    alignItems: "center", justifyContent: "center", padding: 2,
  },
  sbLogo: { width: "100%", height: "100%" },
  sbLogoPlaceholder: { width: 22, height: 22 },
  sbTeamName: { flex: 1, fontSize: 14, fontWeight: "700", color: "rgba(245,243,231,0.75)" },
  sbTeamNameWinner: { color: "#F5F3E7", fontWeight: "800" },
  sbScore: {
    fontSize: 22, fontWeight: "800", color: "rgba(245,243,231,0.75)", minWidth: 34, textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  sbScoreWinner: { color: "#F2C266" },
  sbDivider: { height: 1, backgroundColor: "rgba(245,243,231,0.12)" },

  modalPickText: { fontSize: 13, color: "#45564C" },
  modalPickTextBold: { fontWeight: "800", color: "#0C1712" },
  modalResult: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4, color: "#64748B" },
  modalResultWin: { color: "#166534" },
  modalResultLoss: { color: "#991B1B" },
  modalCloseBtn: { alignSelf: "flex-end", marginTop: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(12,23,18,0.08)" },
  modalCloseBtnText: { fontSize: 12, fontWeight: "700", color: "#45564C" },
});
