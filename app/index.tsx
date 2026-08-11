// FILE: app/index.tsx
export const unstable_settings = { prerender: false };

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { logoUri } from "@/lib/teamLogos";

const HERO_TEAMS: { name: string; sport: "nfl" | "ncaaf"; rotate: number; offset: number }[] = [
  { name: "Kansas City Chiefs", sport: "nfl", rotate: -8, offset: 0 },
  { name: "Philadelphia Eagles", sport: "nfl", rotate: 6, offset: 10 },
  { name: "Dallas Cowboys", sport: "nfl", rotate: -4, offset: 0 },
  { name: "Buffalo Bills", sport: "nfl", rotate: 10, offset: 12 },
  { name: "Georgia Bulldogs", sport: "ncaaf", rotate: -10, offset: 0 },
  { name: "Ohio State Buckeyes", sport: "ncaaf", rotate: 5, offset: 8 },
];

const STEPS = [
  { icon: "people-outline" as const, tint: "#E1F5EE", iconColor: "#085041", title: "Squad up", body: "Create a group or join one with a code", rotate: -4 },
  { icon: "locate-outline" as const, tint: "#E6F1FB", iconColor: "#0C447C", title: "Call your shot", body: "One NFL and one CFB lock, every week", rotate: 4 },
  { icon: "trophy-outline" as const, tint: "#FAECE7", iconColor: "#712B13", title: "Rule the board", body: "Records build all season, live in your group", rotate: -4 },
];

export default function Home() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  const primaryCta = () => router.push(signedIn ? "/groups" : "/auth/login");

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <View style={styles.logoRow}>
          {HERO_TEAMS.map((t) => (
            <View
              key={t.name}
              style={[styles.logoBadge, { transform: [{ rotate: `${t.rotate}deg` }], marginTop: t.offset }]}
            >
              <Image source={{ uri: logoUri(t.name, t.sport) }} style={styles.logoImg} resizeMode="contain" />
            </View>
          ))}
        </View>

        <View style={styles.pill}>
          <Ionicons name="flame-outline" size={16} color="#412402" />
          <Text style={styles.pillText}>Free to play with your crew</Text>
        </View>

        <Text style={styles.h1}>
          Lock it in.{"\n"}
          <Text style={styles.h1Accent}>Talk trash.</Text>{"\n"}
          Repeat.
        </Text>
        <Text style={styles.sub}>
          Weekly NFL and college football picks with your group. One lock a week, bragging rights all season long.
        </Text>

        <View style={styles.ctaRow}>
          <Pressable style={styles.ctaPrimary} onPress={primaryCta}>
            <Text style={styles.ctaPrimaryText}>{signedIn ? "Go to your groups" : "Get started"}</Text>
            <Ionicons name="arrow-forward" size={16} color="white" />
          </Pressable>
          {!signedIn && (
            <Pressable style={styles.ctaSecondary} onPress={() => router.push("/auth/login")}>
              <Text style={styles.ctaSecondaryText}>Sign in</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.stepsRow}>
        {STEPS.map((s) => (
          <View key={s.title} style={styles.stepCard}>
            <View style={[styles.stepIcon, { backgroundColor: s.tint, transform: [{ rotate: `${s.rotate}deg` }] }]}>
              <Ionicons name={s.icon} size={22} color={s.iconColor} />
            </View>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepBody}>{s.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.leaderCard}>
        <View style={styles.leaderHeader}>
          <Ionicons name="bar-chart-outline" size={16} color="#0B735F" />
          <Text style={styles.leaderHeaderText}>This week in "The Boys"</Text>
        </View>
        <View style={[styles.leaderRow, styles.leaderRowHead]}>
          <Text style={[styles.leaderCellHead, { flex: 1.6 }]}>Member</Text>
          <Text style={[styles.leaderCellHead, { flex: 1 }]}>NFL</Text>
          <Text style={[styles.leaderCellHead, { flex: 1 }]}>CFB</Text>
          <Text style={[styles.leaderCellHead, { width: 50, textAlign: "right" }]}>Rec</Text>
        </View>
        <View style={styles.leaderRow}>
          <View style={[styles.leaderUserCell, { flex: 1.6 }]}>
            <View style={[styles.avatar, { backgroundColor: "#E1F5EE" }]}>
              <Text style={[styles.avatarText, { color: "#085041" }]}>JK</Text>
            </View>
            <Text style={styles.leaderName}>Jordan</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={[styles.badge, styles.badgeNfl]}><Text style={[styles.badgeText, { color: "#085041" }]}>Chiefs -1</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={[styles.badge, styles.badgeCfb]}><Text style={[styles.badgeText, { color: "#0C447C" }]}>Georgia +1</Text></View>
          </View>
          <Text style={{ width: 50, textAlign: "right", fontWeight: "700", fontSize: 12 }}>4-1</Text>
        </View>
        <View style={[styles.leaderRow, { borderBottomWidth: 0 }]}>
          <View style={[styles.leaderUserCell, { flex: 1.6 }]}>
            <View style={[styles.avatar, { backgroundColor: "#FAECE7" }]}>
              <Text style={[styles.avatarText, { color: "#712B13" }]}>SP</Text>
            </View>
            <Text style={styles.leaderName}>Sam</Text>
          </View>
          <View style={{ flex: 1 }}><Text style={styles.noPick}>No pick yet</Text></View>
          <View style={{ flex: 1 }}>
            <View style={[styles.badge, styles.badgeCfb]}><Text style={[styles.badgeText, { color: "#0C447C" }]}>Michigan -7</Text></View>
          </View>
          <Text style={{ width: 50, textAlign: "right", fontWeight: "700", fontSize: 12 }}>3-2</Text>
        </View>
      </View>

      <View style={styles.closing}>
        <Text style={styles.closingTitle}>Think you can call it better?</Text>
        <Text style={styles.closingSub}>Prove it. Your group is waiting.</Text>
        <Pressable style={styles.ctaPrimary} onPress={primaryCta}>
          <Text style={styles.ctaPrimaryText}>{signedIn ? "Go to your groups" : "Get started"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40, gap: 28, maxWidth: 640, width: "100%", alignSelf: "center" },

  hero: { alignItems: "center", paddingTop: 12, gap: 4 },
  logoRow: { flexDirection: "row", gap: 10, marginBottom: 18, flexWrap: "wrap", justifyContent: "center" },
  logoBadge: {
    width: 48, height: 48, borderRadius: 999, backgroundColor: "white",
    alignItems: "center", justifyContent: "center", padding: 6,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  logoImg: { width: "100%", height: "100%" },

  pill: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FAC775",
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, marginBottom: 14,
  },
  pillText: { color: "#412402", fontSize: 13, fontWeight: "700" },

  h1: { fontSize: 34, fontWeight: "800", textAlign: "center", lineHeight: 40 },
  h1Accent: { color: "#0B735F" },
  sub: { color: "#475569", fontSize: 16, textAlign: "center", maxWidth: 420, marginTop: 12 },

  ctaRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  ctaPrimary: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0B735F",
    paddingHorizontal: 22, height: 46, borderRadius: 999, justifyContent: "center",
  },
  ctaPrimaryText: { color: "white", fontWeight: "700", fontSize: 15 },
  ctaSecondary: {
    paddingHorizontal: 22, height: 46, borderRadius: 999, justifyContent: "center",
    borderWidth: 1, borderColor: "#CBD5E1",
  },
  ctaSecondaryText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },

  stepsRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  stepCard: {
    flex: 1, minWidth: 150, backgroundColor: "#F8FAFC", borderRadius: 16,
    padding: 18, alignItems: "center", gap: 4,
  },
  stepIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  stepTitle: { fontWeight: "700", fontSize: 14 },
  stepBody: { fontSize: 13, color: "#64748B", textAlign: "center" },

  leaderCard: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 16 },
  leaderHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  leaderHeaderText: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },

  leaderRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB", gap: 8,
  },
  leaderRowHead: { paddingVertical: 4 },
  leaderCellHead: { fontSize: 11, color: "#94A3B8", fontWeight: "700", textTransform: "uppercase" },

  leaderUserCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 11, fontWeight: "700" },
  leaderName: { fontSize: 13, fontWeight: "700" },

  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeNfl: { backgroundColor: "#E1F5EE" },
  badgeCfb: { backgroundColor: "#E6F1FB" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  noPick: { fontSize: 12, color: "#94A3B8" },

  closing: { alignItems: "center", gap: 4, paddingVertical: 8 },
  closingTitle: { fontSize: 17, fontWeight: "700" },
  closingSub: { fontSize: 13, color: "#64748B", marginBottom: 14 },
});
