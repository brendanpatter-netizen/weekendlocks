// app/index.tsx
export const unstable_settings = { prerender: false };

import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";

// If your enum values are uppercase, change to ["NFL", "NCAAF"]
const SPORTS = ["nfl", "cfb"] as const;
type Sport = (typeof SPORTS)[number];

type SoloPickRow = {
  id: number;
  sport: Sport;           // enum cast to text in select below
  pick_team: string | null;
  status: string | null;
  created_at: string;
  game: { id: number; home: string; away: string } | null;
};

type SoloBySport = Partial<Record<Sport, SoloPickRow | null>>;

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solo, setSolo] = useState<SoloBySport>({ nfl: null, cfb: null });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    // Pull only SOLO picks (group_id IS NULL) and newest first.
    const { data, error } = await supabase
      .from("picks")
      .select(
        `
        id,
        sport::text,
        pick_team,
        status,
        created_at,
        game:games(id, home, away)
      `
      )
      .eq("user_id", userId)
      .is("group_id", null)           // <- important: IS NULL (not eq)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Keep the first (newest) for each sport.
    const latest: SoloBySport = { nfl: null, cfb: null };
    for (const row of (data ?? []) as any as SoloPickRow[]) {
      const s = (row.sport ?? "").toLowerCase() as Sport;
      if (!SPORTS.includes(s)) continue;
      if (!latest[s]) latest[s] = row;
      if (latest.nfl && latest.cfb) break;
    }

    setSolo(latest);
    setLastUpdated(new Date());
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) refresh();
  }, [userId, refresh]);

  const clearSolo = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    // Delete ONLY solo picks for this user (any week), both sports.
    const { error } = await supabase
      .from("picks")
      .delete()
      .eq("user_id", userId)
      .is("group_id", null)           // <- important: IS NULL (not eq)
      .in("sport", SPORTS);           // restrict to nfl/cfb

    if (error) {
      setError(error.message);
    }
    await refresh();
  }, [userId, refresh]);

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text>You need to sign in to see your picks.</Text>
      </View>
    );
  }

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;

  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        <Text style={styles.h1}>Live Picks</Text>
        <Link href="/leaderboard" style={styles.leader}>Leaderboard</Link>
      </View>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.h2}>Make Your Picks</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
          <Link href="/picks/college" style={styles.cta}>College Football</Link>
          <Link href="/picks/page" style={styles.cta}>NFL</Link>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>This Week’s Picks</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={refresh} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Refresh</Text>
            </Pressable>
            <Pressable onPress={clearSolo} style={styles.dangerBtn}>
              <Text style={styles.dangerText}>Clear my solo picks</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.meta}>Updated {lastUpdated?.toLocaleTimeString() ?? "—"}</Text>

        {error && <Text style={styles.error}>Error: {error}</Text>}

        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <Text style={[styles.td, { flex: 2 }]}>User</Text>
            <Text style={[styles.td, { flex: 1, textAlign: "center" }]}>CFB</Text>
            <Text style={[styles.td, { flex: 1, textAlign: "center" }]}>NFL</Text>
          </View>

          <View style={styles.tr}>
            <Text style={[styles.td, { flex: 2 }]}>You</Text>

            {/* CFB */}
            <CellPick row={solo.cfb} />

            {/* NFL */}
            <CellPick row={solo.nfl} />
          </View>
        </View>
      </View>
    </View>
  );
}

function CellPick({ row }: { row: SoloPickRow | null | undefined }) {
  if (!row) return <Text style={[styles.td, styles.muted, { flex: 1, textAlign: "center" }]}>—</Text>;
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontWeight: "700" }}>{row.pick_team ?? "—"}</Text>
      {!!row.game && (
        <Text style={{ fontSize: 12, opacity: 0.75 }}>
          {row.game.away} @ {row.game.home}
        </Text>
      )}
      {!!row.status && (
        <Text style={styles.badgePending}>{row.status.toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  page: { padding: 12 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  leader: { color: "#222", fontWeight: "700" },
  h1: { fontSize: 16, fontWeight: "800", backgroundColor: "#111", color: "#fff", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4 },
  h2: { fontSize: 18, fontWeight: "700" },
  card: { backgroundColor: "#e9ecef", borderRadius: 8, padding: 12, marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cta: { backgroundColor: "#111", color: "#fff", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, fontWeight: "700" },
  secondaryBtn: { backgroundColor: "#f1f3f5", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6 },
  secondaryText: { color: "#111", fontWeight: "700" },
  dangerBtn: { backgroundColor: "#fee2e2", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6 },
  dangerText: { color: "#991b1b", fontWeight: "800" },
  meta: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  error: { color: "#991b1b", marginTop: 8 },
  table: { marginTop: 10 },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomColor: "#dfe3e6", borderBottomWidth: StyleSheet.hairlineWidth },
  th: { borderBottomWidth: 2 },
  td: { color: "#111" },
  muted: { opacity: 0.5 },
  badgePending: { marginTop: 2, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, fontSize: 12, color: "#111", backgroundColor: "#dbeafe" },
});
