// app/groups/[id]/index.tsx
export const unstable_settings = { prerender: false };

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
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

type PickRow = {
  user_id: string;
  pick_team: string;
  week?: number;
  sport?: string | null;  // optional; some schemas use "league"
  league?: string | null; // optional; some schemas use "league"
};

type ByUser = Map<string, { count: number; preview: string[] }>;

export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id[0] : id) ?? "", [id]);

  const [groupName, setGroupName] = useState<string>("WeekendLocks");
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState<MemberRow[]>([]);

  const [nflWeek, setNflWeek] = useState<number | null>(null);
  const [cfbWeek, setCfbWeek] = useState<number | null>(null);

  const [nflPicks, setNflPicks] = useState<PickRow[]>([]);
  const [cfbPicks, setCfbPicks] = useState<PickRow[]>([]);

  // debug counters (temporary)
  const [debugNFLAny, setDebugNFLAny] = useState<number>(0);
  const [debugCFBAny, setDebugCFBAny] = useState<number>(0);

  useEffect(() => {
    if (!groupId) return;

    (async () => {
      setLoading(true);

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

      // Use the SAME helpers as the picks pages so weeks line up
      let nflW = typeof getCurrentWeek === "function" ? getCurrentWeek() : 1;
      let cfbW = typeof getCurrentCfbWeek === "function" ? getCurrentCfbWeek() : 1;

      // Smart fallback: if there are no picks for that computed week,
      // show the latest week that actually has picks for this group.
      const [{ data: nflWeeksWithPicks }, { data: cfbWeeksWithPicks }] =
        await Promise.all([
          supabase
            .from("picks")
            .select("week")
            .eq("group_id", groupId)
            .order("week", { ascending: false }),
          supabase
            .from("picks")
            .select("week")
            .eq("group_id", groupId)
            .order("week", { ascending: false }),
        ]);

      const nflWeeks = (nflWeeksWithPicks ?? []).map((r) => Number(r.week)).filter(Number.isFinite);
      const cfbWeeks = (cfbWeeksWithPicks ?? []).map((r) => Number(r.week)).filter(Number.isFinite);

      if (nflWeeks.length && !nflWeeks.includes(nflW)) nflW = nflWeeks[0]!;
      if (cfbWeeks.length && !cfbWeeks.includes(cfbW)) cfbW = cfbWeeks[0]!;

      setNflWeek(nflW);
      setCfbWeek(cfbW);

      // --- IMPORTANT: filter by sport OR league (to match your schema) ---
      // nfl
      const nflQuery = supabase
        .from("picks")
        .select("user_id, pick_team, week, sport, league")
        .eq("group_id", groupId)
        .eq("week", nflW)
        .or("sport.eq.nfl,league.eq.nfl");

      // cfb
      const cfbQuery = supabase
        .from("picks")
        .select("user_id, pick_team, week, sport, league")
        .eq("group_id", groupId)
        .eq("week", cfbW)
        .or("sport.eq.cfb,league.eq.cfb");

      const [{ data: np }, { data: cp }] = await Promise.all([nflQuery, cfbQuery]);

      setNflPicks((np ?? []) as PickRow[]);
      setCfbPicks((cp ?? []) as PickRow[]);

      // tiny debug: also count any picks for that week regardless of sport/league field name
      const [nflAny, cfbAny] = await Promise.all([
        supabase.from("picks").select("id", { count: "exact", head: true })
          .eq("group_id", groupId).eq("week", nflW),
        supabase.from("picks").select("id", { count: "exact", head: true })
          .eq("group_id", groupId).eq("week", cfbW),
      ]);
      setDebugNFLAny(nflAny.count ?? 0);
      setDebugCFBAny(cfbAny.count ?? 0);

      setLoading(false);
    })();
  }, [groupId]);

  // Build aggregates (count + preview)
  const nflByUser: ByUser = useMemo(() => {
    const map: ByUser = new Map();
    for (const p of nflPicks) {
      const cur = map.get(p.user_id) ?? { count: 0, preview: [] };
      cur.count += 1;
      if (cur.preview.length < 3 && p.pick_team) cur.preview.push(p.pick_team);
      map.set(p.user_id, cur);
    }
    return map;
  }, [nflPicks]);

  const cfbByUser: ByUser = useMemo(() => {
    const map: ByUser = new Map();
    for (const p of cfbPicks) {
      const cur = map.get(p.user_id) ?? { count: 0, preview: [] };
      cur.count += 1;
      if (cur.preview.length < 3 && p.pick_team) cur.preview.push(p.pick_team);
      map.set(p.user_id, cur);
    }
    return map;
  }, [cfbPicks]);

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

      {/* TEMP DEBUG STRIP (web only) */}
      {Platform.OS === "web" && (
        <View style={styles.debug}>
          <Text style={styles.debugText}>
            debug: groupId={groupId} · nflW={nflWeek} (any rows: {debugNFLAny}) · cfbW={cfbWeek} (any rows: {debugCFBAny})
          </Text>
        </View>
      )}

      {/* This Week's Picks */}
      <View style={styles.card}>
        <Text style={styles.h2}>This Week’s Picks</Text>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cellUser, styles.headerText]}>User</Text>
          <Text
            style={[styles.cell, styles.headerText, { textAlign: "center" }]}
          >
            CFB (Wk {cfbWeek})
          </Text>
          <Text
            style={[styles.cell, styles.headerText, { textAlign: "center" }]}
          >
            NFL (Wk {nflWeek})
          </Text>
        </View>

        <FlatList
          data={members}
          keyExtractor={(m) => m.user_id}
          renderItem={({ item }) => {
            const name =
              item.display_name ?? item.username ?? item.user_id ?? "—";

            const cfb = cfbByUser.get(item.user_id);
            const nfl = nflByUser.get(item.user_id);

            return (
              <View style={styles.row}>
                <View style={styles.cellUser}>
                  <View style={styles.userCell}>
                    {!!item.avatar_url && (
                      <Image
                        source={{ uri: item.avatar_url }}
                        style={styles.avatar}
                      />
                    )}
                    <Text>{name}</Text>
                  </View>
                </View>

                <Text style={[styles.cell, styles.centerText]}>
                  {(cfb?.count ?? 0).toString()}
                  {cfb?.preview?.length ? (
                    <Text style={styles.preview}>
                      {" "}
                      — {cfb.preview.join(", ")}
                    </Text>
                  ) : null}
                </Text>

                <Text style={[styles.cell, styles.centerText]}>
                  {(nfl?.count ?? 0).toString()}
                  {nfl?.preview?.length ? (
                    <Text style={styles.preview}>
                      {" "}
                      — {nfl.preview.join(", ")}
                    </Text>
                  ) : null}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centerRow}>
              <Text style={styles.muted}>No members yet.</Text>
            </View>
          }
        />
      </View>

      {/* Make Your Picks */}
      <View style={styles.card}>
        <Text style={styles.h2}>Make Your Picks</Text>

        <Text style={styles.h3}>College Football</Text>
        <Pressable
          style={styles.cta}
          onPress={() =>
            router.push({
              pathname: "/picks/college",
              params: { group: groupId },
            })
          }
        >
          <Text style={styles.ctaText}>Go to CFB picks</Text>
        </Pressable>

        <Text style={[styles.h3, { marginTop: 18 }]}>NFL</Text>
        <Pressable
          style={styles.cta}
          onPress={() =>
            router.push({
              pathname: "/picks/page",
              params: { group: groupId },
            })
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
            const name =
              item.display_name ?? item.username ?? item.user_id ?? "—";
            return (
              <View style={styles.memberRow}>
                <Text style={styles.memberName}>{name}</Text>
                <Text style={styles.memberSub}>
                  {(item.role ?? "member") +
                    (item.joined_at
                      ? ` • joined ${new Date(
                          item.joined_at
                        ).toLocaleDateString()}`
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
  centerRow: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: { textAlign: "center" },
  userCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 999, marginRight: 8 },
  preview: { color: "#6b7280" },
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
