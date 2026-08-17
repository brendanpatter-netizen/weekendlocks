export const unstable_settings = { prerender: false };

import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { colors as theme } from "@/lib/theme";
import LockIcon from "@/components/LockIcon";
import TrophyIcon from "@/components/TrophyIcon";
import FlameIcon from "@/components/FlameIcon";
import TapeCorner from "@/components/TapeCorner";

// Three static, illustrative mocks — not real data. Each mirrors the shape
// and colors of the real component so a new user recognizes the real thing
// on sight, without wiring this page to live data or auth.

function SampleGameCard() {
  return (
    <View style={styles.sampleCard}>
      <Text style={styles.sampleMatchup}>Buffalo Bills @ Kansas City Chiefs</Text>
      <Text style={styles.sampleTime}>Sun 4:25 PM</Text>
      <View style={styles.sampleOutcomes}>
        <View style={[styles.sampleOutcome, styles.sampleOutcomePicked]}>
          <Text style={styles.sampleOutcomeTextPicked}>✓ Chiefs -1.5 (-110)</Text>
        </View>
        <View style={[styles.sampleOutcome, styles.sampleOutcomeTaken]}>
          <Text style={styles.sampleOutcomeTextTaken}>Bills +1.5</Text>
          <Text style={styles.sampleTakenLabel}>Taken by Sam</Text>
        </View>
      </View>
    </View>
  );
}

const SAMPLE_STANDINGS = [
  { rank: 1, name: "Jordan", record: "4-1", pct: "80%" },
  { rank: 2, name: "Sam", record: "3-2", pct: "60%" },
  { rank: 3, name: "Alex", record: "1-3", pct: "25%" },
];

function SampleStandings() {
  return (
    <View style={styles.sampleCard}>
      <View style={styles.standingsHeadRow}>
        <Text style={styles.standingsHeadRank}>#</Text>
        <Text style={styles.standingsHeadName}>Member</Text>
        <Text style={styles.standingsHeadRecord}>Record</Text>
      </View>
      {SAMPLE_STANDINGS.map((m) => (
        <View key={m.name} style={styles.standingsRow}>
          <Text style={styles.standingsRank}>{m.rank}</Text>
          <Text style={styles.standingsName}>{m.name}</Text>
          <View style={styles.standingsRecordCell}>
            <Text style={styles.standingsRecord}>{m.record}</Text>
            <Text style={styles.standingsPct}>{m.pct}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

type LockState = "win" | "loss" | "pending";
const SAMPLE_WEEKS: { week: string; jordan: [string, LockState][]; sam: [string, LockState][] }[] = [
  { week: "Wk 1", jordan: [["Georgia -14", "win"], ["Chiefs -3.5", "win"]], sam: [["Bama +6", "loss"], ["Eagles -1", "pending"]] },
  { week: "Wk 2", jordan: [["Ohio St -21", "pending"], ["Bills +2", "loss"]], sam: [["Michigan -10", "win"], ["Ravens -3", "win"]] },
];

function LockCell({ label, state }: { label: string; state: LockState }) {
  return (
    <View style={[styles.lockCell, state === "win" ? styles.lockCellWin : state === "loss" ? styles.lockCellLoss : styles.lockCellPending]}>
      <Text style={styles.lockCellText}>{label}</Text>
    </View>
  );
}

function SampleLocksGrid() {
  return (
    <View style={styles.sampleCard}>
      <View style={styles.gridMemberRow}>
        <View style={styles.gridWeekHead} />
        <Text style={styles.gridMemberHead}>Jordan</Text>
        <Text style={styles.gridMemberHead}>Sam</Text>
      </View>
      <View style={styles.gridSubRow}>
        <View style={styles.gridWeekHead} />
        <View style={styles.gridSubPair}>
          <Text style={styles.gridSubHead}>NCAA</Text>
          <Text style={styles.gridSubHead}>NFL</Text>
        </View>
        <View style={styles.gridSubPair}>
          <Text style={styles.gridSubHead}>NCAA</Text>
          <Text style={styles.gridSubHead}>NFL</Text>
        </View>
      </View>
      {SAMPLE_WEEKS.map((row) => (
        <View key={row.week} style={styles.gridDataRow}>
          <Text style={styles.gridWeekLabel}>{row.week}</Text>
          <View style={styles.gridSubPair}>
            <LockCell label={row.jordan[0][0]} state={row.jordan[0][1]} />
            <LockCell label={row.jordan[1][0]} state={row.jordan[1][1]} />
          </View>
          <View style={styles.gridSubPair}>
            <LockCell label={row.sam[0][0]} state={row.sam[0][1]} />
            <LockCell label={row.sam[1][0]} state={row.sam[1][1]} />
          </View>
        </View>
      ))}
      <View style={styles.gridLegend}>
        <View style={[styles.legendDot, styles.lockCellWin]} /><Text style={styles.legendText}>Win</Text>
        <View style={[styles.legendDot, styles.lockCellLoss]} /><Text style={styles.legendText}>Loss</Text>
        <View style={[styles.legendDot, styles.lockCellPending]} /><Text style={styles.legendText}>Pending</Text>
      </View>
    </View>
  );
}

export default function HowItWorks() {
  return (
    <ScrollView style={styles.pageOuter} contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <View style={styles.heroEyebrow}>
          <LockIcon size={13} color="#F5F3E7" />
          <Text style={styles.heroEyebrowText}>THE RULES</Text>
        </View>
        <Text style={styles.heroTitle}>How It Works</Text>
        <Text style={styles.heroSubtitle}>
          Everything you need to know before your first lock.
        </Text>
      </View>

      <View style={styles.card}>
        <TapeCorner />
        <Text style={styles.cardTitle}>The weekly rhythm</Text>
        <Text style={styles.body}>
          One NFL lock and one CFB lock, every week. During the pre-season CFB-only stretch, it's
          two CFB locks instead — same rhythm, no gap.
        </Text>
      </View>

      <View style={styles.card}>
        <TapeCorner side="right" />
        <Text style={styles.cardTitle}>Making a pick</Text>
        <Text style={styles.body}>
          Pick the spread, the total, or the moneyline. Swap it any time before kickoff — after
          that it's frozen. Once a teammate grabs an outcome, it's gone for everyone else.
        </Text>
      </View>

      <SampleGameCard />

      <View style={styles.card}>
        <TapeCorner />
        <View style={styles.cardTitleRow}>
          <TrophyIcon size={18} color="#B23A2E" />
          <Text style={styles.cardTitle}>The Standings</Text>
        </View>
        <Text style={styles.body}>
          Ranked by win percentage across every decided pick. A push counts as a win.
        </Text>
      </View>

      <SampleStandings />

      <View style={styles.card}>
        <TapeCorner side="right" />
        <View style={styles.cardTitleRow}>
          <LockIcon size={16} color="#B23A2E" />
          <Text style={styles.cardTitle}>Weekend Locks</Text>
        </View>
        <Text style={styles.body}>
          Every pick, every week, at a glance — green's a win, red's a loss, gray's still live.
        </Text>
      </View>

      <SampleLocksGrid />

      <View style={styles.card}>
        <TapeCorner />
        <View style={styles.cardTitleRow}>
          <FlameIcon size={18} color="#B23A2E" />
          <Text style={styles.cardTitle}>Power Rankings</Text>
        </View>
        <Text style={styles.body}>
          Every Tuesday, an AI commissioner roasts the group by name using that week's actual
          picks. Nobody's safe — not even first place.
        </Text>
      </View>

      <View style={styles.closing}>
        <Text style={styles.closingTitle}>Ready to make your first lock?</Text>
        <Pressable style={styles.cta} onPress={() => router.push("/groups")}>
          <Text style={styles.ctaText}>Go to your groups</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageOuter: { flex: 1, backgroundColor: theme.felt },
  page: { padding: 16, gap: 16, paddingBottom: 40, maxWidth: 640, width: "100%", alignSelf: "center" },

  hero: { paddingTop: 8, paddingBottom: 4, gap: 6, alignItems: "center" },
  heroEyebrow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "center", borderWidth: 1.5, borderColor: "rgba(245,243,231,0.4)", borderStyle: "dashed",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 4,
  },
  heroEyebrowText: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#F5F3E7" },
  heroTitle: { fontFamily: "PermanentMarker_400Regular", fontSize: 34, color: "#F5F3E7", textAlign: "center" },
  heroSubtitle: { fontSize: 14, color: "rgba(245,243,231,0.75)", textAlign: "center", fontWeight: "600", maxWidth: 420 },

  card: {
    position: "relative",
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed",
    borderRadius: 10, padding: 14, paddingTop: 18, gap: 8,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontFamily: "PermanentMarker_400Regular", fontSize: 18, color: "#B23A2E" },
  body: { fontSize: 14, color: "#2A362F", lineHeight: 20 },

  // Illustrative mocks: not real interactive cards, so visually distinct
  // (solid border, not dashed) from the paper cards holding the prose.
  sampleCard: {
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)",
    borderRadius: 12, padding: 14, gap: 8,
  },
  sampleMatchup: { fontWeight: "800", fontSize: 14, color: "#0C1712" },
  sampleTime: { fontSize: 12, color: "#45564C" },
  sampleOutcomes: { gap: 8, marginTop: 4 },
  sampleOutcome: {
    backgroundColor: `${theme.brand}22`, borderWidth: 1, borderColor: `${theme.brand}55`,
    borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12,
  },
  sampleOutcomePicked: { backgroundColor: theme.brand, borderColor: theme.brand },
  sampleOutcomeTextPicked: { color: "white", fontWeight: "700", fontSize: 13 },
  sampleOutcomeTaken: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sampleOutcomeTextTaken: { color: "#94A3B8", fontWeight: "700", fontSize: 13, textDecorationLine: "line-through" },
  sampleTakenLabel: { fontSize: 11, color: "#94A3B8", fontStyle: "italic" },

  // Sample standings table
  standingsHeadRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 6 },
  standingsHeadRank: { width: 20, fontSize: 11, fontWeight: "800", color: "#64748B", textTransform: "uppercase" },
  standingsHeadName: { flex: 1, fontSize: 11, fontWeight: "800", color: "#64748B", textTransform: "uppercase" },
  standingsHeadRecord: { width: 60, fontSize: 11, fontWeight: "800", color: "#64748B", textTransform: "uppercase", textAlign: "right" },
  standingsRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
  },
  standingsRank: { width: 20, fontSize: 13, fontWeight: "800", color: "#64748B" },
  standingsName: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0C1712" },
  standingsRecordCell: { width: 60, alignItems: "flex-end" },
  standingsRecord: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  standingsPct: { fontSize: 11, color: "#64748B" },

  // Sample weekly locks grid
  gridMemberRow: { flexDirection: "row" },
  gridSubRow: { flexDirection: "row", marginBottom: 2 },
  gridDataRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB" },
  gridWeekHead: { width: 40 },
  gridWeekLabel: { width: 40, fontSize: 11, fontWeight: "700", color: "#64748B", alignSelf: "center" },
  gridMemberHead: { flex: 1, fontSize: 12, fontWeight: "800", color: "#0C1712", textAlign: "center", paddingBottom: 2 },
  gridSubPair: { flex: 1, flexDirection: "row", gap: 3 },
  gridSubHead: { flex: 1, fontSize: 9, fontWeight: "700", color: "#8B876F", textAlign: "center", textTransform: "uppercase" },
  lockCell: { flex: 1, borderRadius: 5, paddingVertical: 5, paddingHorizontal: 3, marginVertical: 2, alignItems: "center", justifyContent: "center" },
  lockCellWin: { backgroundColor: "#DCFCE7" },
  lockCellLoss: { backgroundColor: "#FEE2E2" },
  lockCellPending: { backgroundColor: "#F1F5F9" },
  lockCellText: { fontSize: 9, fontWeight: "700", color: "#0C1712", textAlign: "center" },
  gridLegend: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 999 },
  legendText: { fontSize: 11, color: "#64748B", fontWeight: "600", marginRight: 6 },

  closing: { alignItems: "center", gap: 12, paddingVertical: 12 },
  closingTitle: { fontFamily: "PermanentMarker_400Regular", fontSize: 20, color: "#F5F3E7", textAlign: "center" },
  cta: { backgroundColor: theme.brand, paddingHorizontal: 22, height: 46, borderRadius: 999, justifyContent: "center" },
  ctaText: { color: "white", fontWeight: "700", fontSize: 15 },
});
