export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";

// ---- Replace these with your helpers if you have them ----
const CURRENT_NFL_WEEK = 5;  // <-- swap to your nfl week getter
const CURRENT_CFB_WEEK = 6;  // <-- swap to your cfb week getter
// ----------------------------------------------------------

type MemberRow = { user_id: string; joined_at?: string; role?: "owner" | "member"; username?: string };

export default function GroupPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id;

  const [me, setMe] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  // weekly counts (use HEAD + count so the URL stays short and avoids 400s)
  const [nflCount, setNflCount] = useState<number | null>(null);
  const [cfbCount, setCfbCount] = useState<number | null>(null);

  const nflW = CURRENT_NFL_WEEK;
  const cfbW = CURRENT_CFB_WEEK;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const u = await supabase.auth.getUser();
        setMe(u.data.user?.id ?? null);

        // members
        const { data: ms, error: mErr } = await supabase
          .from("group_members")
          .select("user_id, role, created_at")
          .eq("group_id", groupId);

        if (mErr) throw mErr;

        const rows: MemberRow[] = (ms ?? []).map((r: any) => ({
          user_id: r.user_id,
          role: r.role,
          joined_at: r.created_at,
        }));

        setMembers(rows);

        // weekly counts using HEAD + count (no body)
        // NFL
        {
          const { error, count } = await supabase
            .from("picks")
            .select("*", { count: "exact", head: true })
            .eq("group_id", groupId)
            .eq("sport", "nfl")
            .eq("week", nflW);

          if (error) {
            setBanner(`[nflW=${nflW}] ${error.message}`);
            setNflCount(0);
          } else {
            setNflCount(count ?? 0);
          }
        }

        // CFB
        {
          const { error, count } = await supabase
            .from("picks")
            .select("*", { count: "exact", head: true })
            .eq("group_id", groupId)
            .eq("sport", "cfb")
            .eq("week", cfbW);

          if (error) {
            setBanner(prev => (prev ? prev + " | " : "") + `[cfbW=${cfbW}] ${error.message}`);
            setCfbCount(0);
          } else {
            setCfbCount(count ?? 0);
          }
        }
      } catch (e: any) {
        console.error("[groups] load error", e);
        setBanner(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, nflW, cfbW]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WeekendLocks</Text>

      {!!banner && <Text style={styles.debug}>debug: groupId={groupId} · nflW={nflW} (count: {nflCount ?? 0}) · cfbW={cfbW} (count: {cfbCount ?? 0}) · msg: {banner}</Text>}

      <View style={styles.card}>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.colUser, styles.headerCell]}>User</Text>
          <Text style={[styles.headerCell, styles.right]}>CFB (Wk {cfbW})</Text>
          <Text style={[styles.headerCell, styles.right]}>NFL (Wk {nflW})</Text>
        </View>

        {members.map((m) => (
          <View key={m.user_id} style={styles.row}>
            <Text style={styles.colUser}>{m.username ?? m.user_id}</Text>
            <Text style={[styles.right, styles.count]}>{m.user_id ? (m.user_id === me ? cfbCount ?? 0 : 0) : 0}</Text>
            <Text style={[styles.right, styles.count]}>{m.user_id ? (m.user_id === me ? nflCount ?? 0 : 0) : 0}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Make Your Picks</Text>

        <Text style={styles.subheader}>College Football</Text>
        <Link href={{ pathname: "/picks/college", params: { group: groupId } }} asChild>
          <Pressable style={styles.btn}><Text style={styles.btnText}>Go to CFB picks</Text></Pressable>
        </Link>

        <Text style={[styles.subheader, { marginTop: 14 }]}>NFL</Text>
        <Link href={{ pathname: "/picks/page", params: { group: groupId } }} asChild>
          <Pressable style={styles.btn}><Text style={styles.btnText}>Go to NFL picks</Text></Pressable>
        </Link>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Members</Text>
        {members.map((m) => (
          <View key={m.user_id} style={styles.memberRow}>
            <Text style={{ fontWeight: m.role === "owner" ? "700" : "400" }}>
              {m.user_id}
            </Text>
            <Text style={{ opacity: 0.6 }}>{m.role ?? "member"} · joined {new Date(m.joined_at ?? Date.now()).toLocaleDateString()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
  debug: { padding: 8, borderWidth: 1, borderColor: "#eab308", backgroundColor: "#fef9c3", borderRadius: 6, marginBottom: 10, color: "#92400e" },

  card: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10, backgroundColor: "#fff", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  headerRow: { borderTopWidth: 0, paddingTop: 0 },
  colUser: { flex: 1 },
  right: { width: 120, textAlign: "right" as const },
  headerCell: { fontWeight: "700", color: "#334155" },
  count: { fontWeight: "700" },

  subheader: { fontWeight: "700", marginBottom: 6 },
  btn: { alignSelf: "flex-start", backgroundColor: "#065f46", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "700" },

  memberRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
});
