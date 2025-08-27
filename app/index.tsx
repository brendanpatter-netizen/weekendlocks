// FILE: app/index.tsx
export const unstable_settings = { prerender: false };

import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert, Pressable } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getCurrentWeek } from "@/lib/nflWeeks";
import { getCurrentCfbWeek } from "@/lib/cfbWeeks";

type SoloPickRow = {
  sport: "NFL" | "NCAAF";
  week: number;
  pick_team: string | null;
  game_id: number | null;
  status: string | null;
  created_at: string;
};

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nfl, setNFL] = useState<SoloPickRow | null>(null);
  const [cfb, setCFB] = useState<SoloPickRow | null>(null);
  const weekNFL = getCurrentWeek?.() ?? 1;
  const weekCFB = getCurrentCfbWeek?.() ?? 1;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setBusy(true);

    const [pN, pC] = await Promise.all([
      supabase.from("picks")
        .select("sport,week,pick_team,game_id,status,created_at")
        .eq("user_id", userId)
        .is("group_id", null)
        .eq("sport", "NFL")
        .eq("week", weekNFL)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("picks")
        .select("sport,week,pick_team,game_id,status,created_at")
        .eq("user_id", userId)
        .is("group_id", null)
        .eq("sport", "NCAAF")
        .eq("week", weekCFB)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!pN.error) setNFL((pN.data as SoloPickRow) || null);
    if (!pC.error) setCFB((pC.data as SoloPickRow) || null);
    setBusy(false);
  }, [userId, weekNFL, weekCFB]);

  useEffect(() => { if (userId) load(); }, [userId, load]);

  const clearSolo = useCallback(async () => {
    if (!userId) return;
    const ok = true;
    if (!ok) return;
    const { error } = await supabase.from("picks").delete().match({ user_id: userId }).is("group_id", null);
    if (error) return Alert.alert("Error", error.message);
    setNFL(null);
    setCFB(null);
    Alert.alert("Cleared", "Your solo picks were removed.");
  }, [userId]);

  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        <Text style={styles.h1}>Live Picks</Text>
        <Link href="/leaderboard" style={styles.leader}>Leaderboard</Link>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Make Your Picks</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
          <Link href="/picks/college" style={styles.cta}>College Football</Link>
          <Link href="/picks/page" style={styles.cta}>NFL</Link>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.h2}>This Week’s Picks</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={load} style={styles.smallBtn}><Text style={styles.smallBtnText}>Refresh</Text></Pressable>
            <Pressable onPress={clearSolo} style={[styles.smallBtn, { backgroundColor: "#b11" }]}><Text style={styles.smallBtnText}>Clear my solo picks</Text></Pressable>
          </View>
        </View>

        {busy ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : (
          <>
            <View style={styles.gridHeader}>
              <Text style={[styles.colUser]}>User</Text>
              <Text style={styles.col}>CFB</Text>
              <Text style={styles.col}>NFL</Text>
            </View>

            <View style={styles.gridRow}>
              <Text style={styles.colUser}>You</Text>
              <Text style={styles.col}>{cfb?.pick_team ?? "—"}</Text>
              <Text style={styles.col}>{nfl?.pick_team ?? "—"}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, gap: 12 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  leader: { backgroundColor: "#ddd", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  h1: { fontWeight: "700" },
  h2: { fontSize: 16, fontWeight: "700" },
  card: { backgroundColor: "#eee", borderRadius: 8, padding: 12 },
  cta: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#111", color: "#fff", borderRadius: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smallBtn: { backgroundColor: "#444", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { color: "#fff", fontWeight: "600" },
  gridHeader: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ccc", marginTop: 12 },
  gridRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ddd" },
  colUser: { flex: 1, fontWeight: "700" },
  col: { flex: 1, textAlign: "center" },
});
