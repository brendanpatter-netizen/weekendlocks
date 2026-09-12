export const unstable_settings = { prerender: false };

// Owner-only usage snapshot — reachable only by direct URL, no nav link
// anywhere, so nothing changes in what any other user sees. The real gate
// is server-side (api/admin-stats.js checks the caller's email against
// ADMIN_EMAIL before touching any data) — this page just calls that
// endpoint and renders whatever it gets back; a 404 here looks identical
// to hitting any other page that doesn't exist.
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors as theme } from "@/lib/theme";

type Summary = {
  totalUsers: number; newLast7d: number; newLast30d: number; activeLast7d: number;
  totalGroups: number; totalPicks: number; picksLast7d: number;
};
type UserRow = { id: string; email: string; display_name: string | null; created_at: string; last_sign_in_at: string | null };
type GroupRow = { id: string; name: string; created_at: string; member_count: number };

function fmtDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AdminPage() {
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { if (mounted) setState("denied"); return; }

      try {
        const res = await fetch("/api/admin-stats", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { if (mounted) setState("denied"); return; }
        const json = await res.json();
        if (!mounted) return;
        setSummary(json.summary);
        setUsers(json.users);
        setGroups(json.groups);
        setState("ready");
      } catch {
        if (mounted) setState("denied");
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (state === "denied") router.replace("/");
  }, [state]);

  if (state !== "ready" || !summary) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator color={theme.paper} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.pageOuter} contentContainerStyle={styles.page}>
      <Text style={styles.pageTitle}>Admin</Text>

      <View style={styles.statsRow}>
        <StatCard label="Total users" value={summary.totalUsers} />
        <StatCard label="New (7d)" value={summary.newLast7d} />
        <StatCard label="New (30d)" value={summary.newLast30d} />
        <StatCard label="Active (7d)" value={summary.activeLast7d} />
        <StatCard label="Groups" value={summary.totalGroups} />
        <StatCard label="Picks (7d)" value={summary.picksLast7d} />
        <StatCard label="Picks (all-time)" value={summary.totalPicks} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Groups ({groups.length})</Text>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={styles.thName}>Name</Text>
          <Text style={styles.thMembers}>Members</Text>
          <Text style={styles.thDate}>Created</Text>
        </View>
        {groups.map((g) => (
          <View key={g.id} style={styles.tableRow}>
            <Text style={styles.tdName} numberOfLines={1}>{g.name}</Text>
            <Text style={styles.tdMembers}>{g.member_count}</Text>
            <Text style={styles.tdDate}>{fmtDate(g.created_at)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Users ({users.length})</Text>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={styles.thEmail}>Email</Text>
          <Text style={styles.thDate}>Joined</Text>
          <Text style={styles.thDate}>Last active</Text>
        </View>
        {users.map((u) => (
          <View key={u.id} style={styles.tableRow}>
            <View style={styles.tdEmail}>
              <Text numberOfLines={1} style={styles.tdEmailText}>{u.email}</Text>
              {!!u.display_name && <Text numberOfLines={1} style={styles.tdNameSub}>{u.display_name}</Text>}
            </View>
            <Text style={styles.tdDate}>{fmtDate(u.created_at)}</Text>
            <Text style={styles.tdDate}>{fmtDate(u.last_sign_in_at)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingPage: { flex: 1, backgroundColor: theme.felt, alignItems: "center", justifyContent: "center" },
  pageOuter: { flex: 1, backgroundColor: theme.felt },
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  pageTitle: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 26, color: theme.paper },

  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: {
    flexGrow: 1, minWidth: 110, backgroundColor: theme.paperRaised, borderRadius: 10,
    borderWidth: 1, borderColor: theme.line, padding: 12, alignItems: "center", gap: 2,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: theme.ink },
  statLabel: { fontSize: 11, color: theme.inkSoft, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },

  card: { backgroundColor: theme.paperRaised, borderRadius: 10, borderWidth: 1, borderColor: theme.line, padding: 14, gap: 4 },
  cardTitle: { fontWeight: "800", fontSize: 15, color: theme.ink, marginBottom: 6 },

  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line, gap: 8 },
  tableHeader: { borderTopWidth: 0 },
  thName: { flex: 2, fontSize: 10, fontWeight: "700", color: theme.inkSoft, textTransform: "uppercase" },
  thMembers: { width: 70, fontSize: 10, fontWeight: "700", color: theme.inkSoft, textTransform: "uppercase" },
  thDate: { width: 100, fontSize: 10, fontWeight: "700", color: theme.inkSoft, textTransform: "uppercase" },
  thEmail: { flex: 2, fontSize: 10, fontWeight: "700", color: theme.inkSoft, textTransform: "uppercase" },
  tdName: { flex: 2, fontSize: 13, fontWeight: "700", color: theme.ink },
  tdMembers: { width: 70, fontSize: 13, color: theme.ink },
  tdDate: { width: 100, fontSize: 12, color: theme.inkSoft },
  tdEmail: { flex: 2, minWidth: 0 },
  tdEmailText: { fontSize: 13, fontWeight: "700", color: theme.ink },
  tdNameSub: { fontSize: 11, color: theme.inkSoft },
});
