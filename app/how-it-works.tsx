export const unstable_settings = { prerender: false };

import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { colors as theme } from "@/lib/theme";
import LockIcon from "@/components/LockIcon";
import TrophyIcon from "@/components/TrophyIcon";
import FlameIcon from "@/components/FlameIcon";
import TapeCorner from "@/components/TapeCorner";

// A static, illustrative game card — not real odds. Mirrors the real picks
// page's game-card and outcome-button shapes so a new user recognizes the
// real thing on sight, without wiring this page to live data or auth.
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

export default function HowItWorks() {
  return (
    <ScrollView style={styles.pageOuter} contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <View style={styles.heroEyebrow}>
          <LockIcon size={13} color="#F5F3E7" />
          <Text style={styles.heroEyebrowText}>THE RULES</Text>
        </View>
        <Text style={styles.heroTitle}>How it works</Text>
        <Text style={styles.heroSubtitle}>
          Everything you need to know before you make your first lock.
        </Text>
      </View>

      <View style={styles.card}>
        <TapeCorner />
        <Text style={styles.cardTitle}>The weekly rhythm</Text>
        <Text style={styles.body}>
          Every week, each member of your group picks one NFL lock and one CFB lock — two picks
          total, once a week. That's it. No parlays, no daily grind, just two calls you have to
          live with until the games are final.
        </Text>
        <Text style={styles.body}>
          College football usually kicks off a couple of weekends before the NFL season opens.
          During that gap, there's no NFL lock to make yet — so you pick two CFB locks instead,
          keeping the "two picks a week" rhythm going all season.
        </Text>
      </View>

      <View style={styles.card}>
        <TapeCorner side="right" />
        <Text style={styles.cardTitle}>Making a pick</Text>
        <Text style={styles.body}>
          Open a game and choose your side from three markets: the spread, the total
          (over/under), or the moneyline. Tap an outcome to lock it in.
        </Text>
        <Text style={styles.body}>
          Changed your mind? Swap your pick for a different outcome any time before that game's
          kickoff. Once a game starts, your pick for it is frozen — win, lose, or push.
        </Text>
        <Text style={styles.body}>
          One outcome, one owner per group: once a teammate has locked in a specific pick, it's
          off the board for everyone else in your group. Compete against the group's whole week,
          not just the final score.
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
          Ranked by win percentage across every decided pick, NFL and CFB combined. A push counts
          as a win — nobody gets punished for a tie. Haven't decided any games yet? You start at
          the bottom until you do; the board rewards showing up, not just existing.
        </Text>
      </View>

      <View style={styles.card}>
        <TapeCorner side="right" />
        <View style={styles.cardTitleRow}>
          <FlameIcon size={18} color="#B23A2E" />
          <Text style={styles.cardTitle}>Power Rankings</Text>
        </View>
        <Text style={styles.body}>
          Every Tuesday morning, once the weekend's games are final, an AI commissioner bot
          writes your group a fresh countdown — worst record to best — roasting everyone by name
          using that week's actual picks, streaks, and record. No pick that week is its own kind
          of roast-worthy. First place doesn't escape it either.
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

  // The one non-card element: an illustrative mock, not a real interactive
  // picks card, so it's visually distinct from the paper cards around it.
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

  closing: { alignItems: "center", gap: 12, paddingVertical: 12 },
  closingTitle: { fontFamily: "PermanentMarker_400Regular", fontSize: 20, color: "#F5F3E7", textAlign: "center" },
  cta: { backgroundColor: theme.brand, paddingHorizontal: 22, height: 46, borderRadius: 999, justifyContent: "center" },
  ctaText: { color: "white", fontWeight: "700", fontSize: 15 },
});
