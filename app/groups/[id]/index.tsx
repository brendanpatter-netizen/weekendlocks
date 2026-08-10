export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View,
} from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getCurrentWeek as getCurrentNFLWeek } from "@/lib/nflWeeks";
import { getCurrentCfbWeek as getCurrentCFBWeek } from "@/lib/cfbWeeks";

type PickInfo = { market: string | null; team: string | null; line: string | null; price: number | null };
type MemberRow = { user_id: string; display_name: string; nfl: PickInfo | null; cfb: PickInfo | null };
type ActivityItem = {
  id: string; user_id: string; display_name: string; sport: "nfl" | "cfb"; week: number;
  market: string | null; team: string | null; line: string | null; updated_at: string; was_replaced: boolean;
};

function pickLabel(p: PickInfo | null): string {
  if (!p) return "—";
  const line = p.line ? ` ${p.line}` : "";
  return `${p.team ?? "?"}${line}`;
}

export default function GroupDashboardPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id?.[0] : id) ?? "", [id]);

  const nflWeek = useMemo(() => getCurrentNFLWeek(), []);
  const cfbWeek = useMemo(() => getCurrentCFBWeek(), []);

  const [groupName, setGroupName] = useState("WeekendLocks");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setBanner(null);

        const { data: g } = await supabase
          .from("groups")
          .select("name")
          .eq("id", groupId)
          .maybeSingle();
        if (mounted && g?.name) setGroupName(g.name);

        // Roster is the source of truth — every member shows up, even with no picks yet.
        const { data: gm } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", groupId);
        const rosterIds = (gm ?? []).map((r: any) => r.user_id as string);

        const { data: profs } = rosterIds.length
          ? await supabase.from("profiles").select("id, display_name, username").in("id", rosterIds)
          : { data: [] as any[] };
        const nameById = new Map<string, string>(
          rosterIds.map((uid) => {
            const p = (profs ?? []).find((x: any) => x.id === uid);
            return [uid, p?.display_name || p?.username || uid];
          })
        );

        const [{ data: nflRows }, { data: cfbRows }] = await Promise.all([
          supabase.from("picks").select("user_id, market, team, line, price")
            .eq("group_id", groupId).eq("sport", "nfl").eq("week", nflWeek),
          supabase.from("picks").select("user_id, market, team, line, price")
            .eq("group_id", groupId).eq("sport", "cfb").eq("week", cfbWeek),
        ]);
        const nflByUser = new Map((nflRows ?? []).map((r: any) => [r.user_id, r as PickInfo]));
        const cfbByUser = new Map((cfbRows ?? []).map((r: any) => [r.user_id, r as PickInfo]));

        const rows: MemberRow[] = rosterIds
          .map((uid) => ({
            user_id: uid,
            display_name: nameById.get(uid) ?? uid,
            nfl: nflByUser.get(uid) ?? null,
            cfb: cfbByUser.get(uid) ?? null,
          }))
          .sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }));
        if (mounted) setMembers(rows);

        // Broad recent-activity feed (not limited to the current week) — each row is
        // labeled with sport + week so it's unambiguous.
        const { data: feedRows } = await supabase
          .from("picks_feed")
          .select("id, user_id, display_name, sport, week, market, team, line, updated_at, was_replaced")
          .eq("group_id", groupId)
          .order("updated_at", { ascending: false })
          .limit(20);
        if (mounted) setActivity((feedRows ?? []) as ActivityItem[]);
      } catch (e: any) {
        if (mounted) setBanner(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [groupId, nflWeek, cfbWeek]);

  const nflPicked = members.filter((m) => m.nfl);
  const cfbPicked = members.filter((m) => m.cfb);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{groupName}</Text>
      <Text style={styles.subtitle}>NFL Week {nflWeek} • CFB Week {cfbWeek}</Text>

      {banner && (<View style={styles.banner}><Text style={styles.bannerText}>Heads up: {banner}</Text></View>)}

      <View style={styles.ctaRow}>
        <Pressable
          style={styles.cta}
          onPress={() => router.push({ pathname: "/picks/page", params: { group: groupId, w: String(nflWeek) } } as Href)}
        >
          <Text style={styles.ctaText}>Make NFL pick</Text>
        </Pressable>
        <Pressable
          style={styles.cta}
          onPress={() => router.push({ pathname: "/picks/college", params: { group: groupId, w: String(cfbWeek) } } as Href)}
        >
          <Text style={styles.ctaText}>Make CFB pick</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        <>
          {/* Combined leaderboard */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Group leaderboard</Text>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.thUser}>Member</Text>
              <Text style={styles.thPick}>NFL Wk {nflWeek}</Text>
              <Text style={styles.thPick}>CFB Wk {cfbWeek}</Text>
            </View>
            {members.length === 0 ? (
              <Text style={styles.empty}>No members yet.</Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(m) => m.user_id}
                renderItem={({ item }) => (
                  <View style={styles.tableRow}>
                    <Text style={styles.userName}>{item.display_name}</Text>
                    <Text style={styles.pickCell}>{pickLabel(item.nfl)}</Text>
                    <Text style={styles.pickCell}>{pickLabel(item.cfb)}</Text>
                  </View>
                )}
              />
            )}
            <Text style={styles.note}>Season records &amp; win % coming soon.</Text>
          </View>

          <View style={styles.split}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Current NFL picks</Text>
              {nflPicked.length === 0 ? (
                <Text style={styles.empty}>No picks yet for Week {nflWeek}.</Text>
              ) : (
                nflPicked.map((m) => (
                  <View key={m.user_id} style={styles.tableRow}>
                    <Text style={styles.userName}>{m.display_name}</Text>
                    <Text style={styles.pickCell}>{pickLabel(m.nfl)}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Current CFB picks</Text>
              {cfbPicked.length === 0 ? (
                <Text style={styles.empty}>No picks yet for Week {cfbWeek}.</Text>
              ) : (
                cfbPicked.map((m) => (
                  <View key={m.user_id} style={styles.tableRow}>
                    <Text style={styles.userName}>{m.display_name}</Text>
                    <Text style={styles.pickCell}>{pickLabel(m.cfb)}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Recent activity */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent group activity</Text>
            {activity.length === 0 ? (
              <Text style={styles.empty}>No recent activity.</Text>
            ) : (
              <FlatList
                data={activity}
                keyExtractor={(a) => a.id}
                renderItem={({ item }) => (
                  <View style={styles.feedRow}>
                    <Text style={styles.feedTitle}>
                      {item.display_name} {item.was_replaced ? "replaced their" : "picked"} {item.team ?? "a pick"}
                      {item.line ? ` ${item.line}` : ""}
                    </Text>
                    <Text style={styles.feedSub}>
                      {item.sport.toUpperCase()} • Week {item.week}
                      {item.market ? ` • ${item.market}` : ""}
                    </Text>
                    <Text style={styles.feedTime}>{new Date(item.updated_at).toLocaleString()}</Text>
                  </View>
                )}
              />
            )}
          </View>

          {/* Members roster */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Group members</Text>
            {members.length === 0 ? (
              <Text style={styles.empty}>No members yet.</Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(m) => `roster-${m.user_id}`}
                renderItem={({ item }) => (
                  <View style={styles.tableRow}>
                    <Text style={styles.userName}>{item.display_name}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#475569", fontWeight: "600", marginTop: -8 },

  banner: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderWidth: 1, borderRadius: 8, padding: 10 },
  bannerText: { color: "#9A3412" },

  ctaRow: { flexDirection: "row", gap: 12 },
  cta: { flex: 1, backgroundColor: "#0B735F", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  ctaText: { color: "white", fontWeight: "800" },

  split: { flexDirection: "row", gap: 16 },

  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, flex: 1, gap: 4 },
  cardTitle: { fontWeight: "800", marginBottom: 8 },

  tableHeader: { paddingVertical: 6 },
  tableRow: {
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  thUser: { flex: 1.4, fontWeight: "800" },
  thPick: { flex: 1, fontWeight: "800", textAlign: "right" },

  userName: { flex: 1.4, fontWeight: "700" },
  pickCell: { flex: 1, textAlign: "right", color: "#334155" },

  note: { marginTop: 8, color: "#94A3B8", fontSize: 12 },
  empty: { paddingVertical: 8, color: "#64748B" },

  feedRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB", gap: 2 },
  feedTitle: { fontWeight: "700" },
  feedSub: { color: "#334155" },
  feedTime: { color: "#64748B", fontSize: 12, marginTop: 2 },
});
