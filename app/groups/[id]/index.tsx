// app/groups/[id]/index.tsx
export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  FlatList,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getCurrentWeek } from "@/lib/nflWeeks";
import { getCurrentCfbWeek } from "@/lib/cfbWeeks";

type MemberRow = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url?: string | null;
};

export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id[0] : id) ?? "", [id]);

  const [groupName, setGroupName] = useState<string>("WeekendLocks");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  // current weeks (use same helpers as picks pages)
  const [nflWeek, setNflWeek] = useState<number | null>(null);
  const [cfbWeek, setCfbWeek] = useState<number | null>(null);

  // counts (HEAD+count)
  const [nflCount, setNflCount] = useState<number | null>(null);
  const [cfbCount, setCfbCount] = useState<number | null>(null);

  // surface any API errors in a banner
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;

    (async () => {
      try {
        setLoading(true);
        setBanner(null);

        // Group name
        const { data: g } = await supabase
          .from("groups")
          .select("name")
          .eq("id", groupId)
          .maybeSingle();
        if (g?.name) setGroupName(g.name);

        // Members (prefer consolidated view; fallback join)
        const tryView = await supabase
          .from("group_member_profiles")
          .select("user_id, role, joined_at, display_name, username, avatar_url")
          .eq("group_id", groupId)
          .order("joined_at", { ascending: true });

        if (!tryView.error && tryView.data) {
          setMembers(tryView.data as MemberRow[]);
        } else {
          const fallback = await supabase
            .from("group_members")
            .select("user_id, role, joined_at, profiles:profiles ( username, id )")
            .eq("group_id", groupId)
            .order("joined_at", { ascending: true });

          const mapped: MemberRow[] =
            (fallback.data ?? []).map((r: any) => ({
              user_id: r.user_id,
              role: r.role ?? null,
              joined_at: r.joined_at ?? null,
              display_name: r.profiles?.username ?? r.user_id,
              username: r.profiles?.username ?? null,
              avatar_url: null,
            })) ?? [];

          setMembers(mapped);
        }

        // Use the same week logic as the picks pages
        let nflW = typeof getCurrentWeek === "function" ? getCurrentWeek() : 1;
        let cfbW = typeof getCurrentCfbWeek === "function" ? getCurrentCfbWeek() : 1;

        // If no picks exist for these computed weeks, fall back to latest week with picks
        const [{ data: nflWeeks }, { data: cfbWeeks }] = await Promise.all([
          supabase.from("picks").select("week").eq("group_id", groupId).order("week", { ascending: false }),
          supabase.from("picks").select("week").eq("group_id", groupId).order("week", { ascending: false }),
        ]);

        const nflWeekList = (nflWeeks ?? []).map((r) => Number(r.week)).filter(Number.isFinite);
        const cfbWeekList = (cfbWeeks ?? []).map((r) => Number(r.week)).filter(Number.isFinite);

        if (nflWeekList.length && !nflWeekList.includes(nflW)) nflW = nflWeekList[0]!;
        if (cfbWeekList.length && !cfbWeekList.includes(cfbW)) cfbW = cfbWeekList[0]!;

        setNflWeek(nflW);
        setCfbWeek(cfbW);

        // --- Safe counts (HEAD + count) ---
        // NFL (sport enum OR legacy league)
        const nflHead = await supabase
          .from("picks")
          .select("*", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("week", nflW)
          .or("sport.eq.nfl,league.eq.nfl");
        if (nflHead.error) setBanner((b) => (b ? b + " | " : "") + `[NFL] ${nflHead.error.message}`);
        setNflCount(nflHead.count ?? 0);

        // CFB
        const cfbHead = await supabase
          .from("picks")
          .select("*", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("week", cfbW)
          .or("sport.eq.cfb,league.eq.cfb");
        if (cfbHead.error) setBanner((b) => (b ? b + " | " : "") + `[CFB] ${cfbHead.error.message}`);
        setCfbCount(cfbHead.count ?? 0);
      } catch (e: any) {
        console.error("[groups] load error", e);
        setBanner(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  if (!groupId) {
    return (
      <View style={styles.center}>
        <Text>Invalid group.</Text>
      </View>
    );
  }

  if (loading || nflWeek == null || cfbWeek == null) {
    return <ActivityIndicator style={styles.center} size="large" />;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{groupName}</Text>

      {/* Debug / error banner */}
      {!!banner && (
        <View style={styles.debug}>
          <Text style={styles.debugText}>
            debug: groupId={groupId} · nflW={nflWeek} · cfbW={cfbWeek} · {banner}
          </Text>
        </View>
      )}

      {/* This Week's Picks */}
      <View style={styles.card}>
        <Text style={styles.h2}>This Week’s Picks</Text>

        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cellUser, styles.headerText]}>User</Text>
          <Text style={[styles.cell, styles.headerText, styles.centerText]}>CFB (Wk {cfbWeek})</Text>
          <Text style={[styles.cell, styles.headerText, styles.centerText]}>NFL (Wk {nflWeek})</Text>
        </View>

        <FlatList
          data={members}
          keyExtractor={(m) => m.user_id}
          renderItem={({ item }) => {
            const name = item.display_name ?? item.username ?? item.user_id ?? "—";
            return (
              <View style={styles.row}>
                <View style={styles.cellUser}>
                  <View style={styles.userCell}>
                    {!!item.avatar_url && (
                      <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                    )}
                    <Text>{name}</Text>
                  </View>
                </View>
                <Text style={[styles.cell, styles.centerText]}>{nflCount ?? 0 /* per-user breakdown TBD */}</Text>
                <Text style={[styles.cell, styles.centerText]}>{cfbCount ?? 0 /* per-user breakdown TBD */}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>No members yet.</Text>}
        />
      </View>

      {/* Make Your Picks */}
      <View style={styles.card}>
        <Text style={styles.h2}>Make Your Picks</Text>

        <Text style={styles.h3}>College Football</Text>
        <Pressable
          style={styles.cta}
          onPress={() =>
            router.push({ pathname: "/picks/college", params: { group: groupId } })
          }
        >
          <Text style={styles.ctaText}>Go to CFB picks</Text>
        </Pressable>

        <Text style={[styles.h3, { marginTop: 18 }]}>NFL</Text>
        <Pressable
          style={styles.cta}
          onPress={() =>
            router.push({ pathname: "/picks/page", params: { group: groupId } })
          }
        >
          <Text style={styles.ctaText}>Go to NFL picks</Text>
        </Pressable>
      </View>

      {/* Members */}
      <View style={styles.card}>
        <Text style={styles.h2}>Members</Text>
        <FlatList
          data={members}
          keyExtractor={(m) => m.user_id}
          renderItem={({ item }) => {
            const name = item.display_name ?? item.username ?? item.user_id ?? "—";
            return (
              <View style={styles.memberRow}>
                <Text style={styles.memberName}>{name}</Text>
                <Text style={styles.memberSub}>
                  {(item.role ?? "member") +
                    (item.joined_at
                      ? ` • joined ${new Date(item.joined_at).toLocaleDateString()}`
                      : "")}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>No members yet.</Text>}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  h2: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  h3: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  muted: { color: "#6b7280" },
  card: { backgroundColor: "#e5e7eb33", borderRadius: 8, padding: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d1d5db",
  },
  headerRow: { borderTopWidth: 0, paddingTop: 0, paddingBottom: 8 },
  headerText: { fontWeight: "700" },
  cellUser: { flex: 1.5 },
  cell: { flex: 0.5 },
  centerText: { textAlign: "center" },
  userCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 999, marginRight: 8 },
  cta: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#0b735f",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaText: { color: "white", fontWeight: "700" },
  memberRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d1d5db",
  },
  memberName: { fontWeight: "700" },
  memberSub: { color: "#6b7280", marginTop: 2 },
  debug: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  debugText: { color: "#9a3412", fontSize: 12 },
});
