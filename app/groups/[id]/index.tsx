export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getCurrentWeek as getCurrentNFLWeek } from "@/lib/nflWeeks";
import { getCurrentCfbWeek as getCurrentCFBWeek } from "@/lib/cfbWeeks";

type Sport = "nfl" | "cfb";
type Member = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  picks_count: number;
};
type FeedItem = {
  id: string;
  created_at: string;
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  sport: "nfl" | "cfb";
  week: number;
  market?: string | null;
  team?: string | null;
  line?: string | null;
};

export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id?.[0] : id) ?? "", [id]);

  const [groupName, setGroupName] = useState("WeekendLocks");
  const [sport, setSport] = useState<Sport>("nfl");
  const [week, setWeek] = useState<number>(getCurrentNFLWeek());
  const [members, setMembers] = useState<Member[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [roster, setRoster] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    setWeek(sport === "nfl" ? getCurrentNFLWeek() : getCurrentCFBWeek());
  }, [sport]);

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
        if (g?.name) setGroupName(g.name);

        // Try the view first (if you created it)
        const { data: viewRows, error: viewErr } = await supabase
          .from("v_group_week_member_picks")
          .select("user_id, display_name, picks_count")
          .eq("group_id", groupId)
          .eq("sport", sport)
          .eq("week", week)
          .order("display_name", { ascending: true });

        if (!viewErr && viewRows) {
          const ids = viewRows.map((r) => r.user_id);
          const { data: pf } = await supabase
            .from("profiles")
            .select("id, avatar_url")
            .in("id", ids);
          const avatarById = new Map((pf ?? []).map((p) => [p.id, p.avatar_url]));
          if (mounted) {
            setMembers(
              viewRows.map((r: any) => ({
                ...r,
                avatar_url: avatarById.get(r.user_id) ?? null,
              }))
            );
          }
        } else {
          // Fallback aggregate from picks
          const { data: raw, error } = await supabase
            .from("picks")
            .select("user_id")
            .eq("group_id", groupId)
            .eq("sport", sport)
            .eq("week", week);
          if (error) throw error;
          const counts = new Map<string, number>();
          (raw ?? []).forEach((r: any) =>
            counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1)
          );

          const ids = [...counts.keys()];
          const { data: pf } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", ids);

          const nameById = new Map<string, string>();
          (pf ?? []).forEach((p: any) => nameById.set(p.id, p.username || p.id));

          if (mounted) {
            setMembers(
              ids
                .map((uid) => ({
                  user_id: uid,
                  display_name: nameById.get(uid) ?? uid,
                  avatar_url:
                    (pf ?? []).find((p: any) => p.id === uid)?.avatar_url ?? null,
                  picks_count: counts.get(uid) ?? 0,
                }))
                .sort((a, b) =>
                  a.display_name.localeCompare(b.display_name, undefined, {
                    sensitivity: "base",
                  })
                )
            );
          }
        }

        // Activity feed
        const { data: feedRows } = await supabase
          .from("picks")
          .select("id, created_at, user_id, sport, week, market, team, line")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
          .limit(20);

        const feedIds = (feedRows ?? []).map((r) => r.user_id);
        const { data: pf2 } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", feedIds);
        const byId = new Map(
          (pf2 ?? []).map((p: any) => [
            p.id,
            { name: p.username || p.id, avatar: p.avatar_url ?? null },
          ])
        );

        if (mounted) {
          setFeed(
            (feedRows ?? []).map((r: any) => ({
              id: r.id,
              created_at: r.created_at,
              user_id: r.user_id,
              display_name: byId.get(r.user_id)?.name ?? r.user_id,
              avatar_url: byId.get(r.user_id)?.avatar ?? null,
              sport: r.sport,
              week: r.week,
              market: r.market ?? null,
              team: r.team ?? null,
              line: r.line ?? null,
            }))
          );
        }

        // Roster (members list with names)
        const { data: gm } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", groupId);
        const rosterIds = (gm ?? []).map((r: any) => r.user_id);
        if (rosterIds.length) {
          const { data: pr } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", rosterIds);
          const rows: Member[] = rosterIds
            .map((uid) => {
              const p = (pr ?? []).find((x: any) => x.id === uid);
              return {
                user_id: uid,
                display_name: p?.username ?? uid,
                avatar_url: p?.avatar_url ?? null,
                picks_count: 0,
              };
            })
            .sort((a, b) =>
              a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })
            );
          if (mounted) setRoster(rows);
        } else if (mounted) {
          setRoster([]);
        }
      } catch (e: any) {
        if (mounted) setBanner(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [groupId, sport, week]);

  const total = members.reduce((s, m) => s + m.picks_count, 0);
  const max = Math.max(0, ...members.map((m) => m.picks_count));

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{groupName}</Text>

      {banner && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Heads up: {banner}</Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controlsRow}>
        <View style={styles.sportTabs}>
          <Pressable
            onPress={() => setSport("nfl")}
            style={[styles.sportTab, sport === "nfl" && styles.sportTabActive]}
          >
            <Text style={[styles.sportTabText, sport === "nfl" && styles.sportTabTextActive]}>
              NFL
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSport("cfb")}
            style={[styles.sportTab, sport === "cfb" && styles.sportTabActive]}
          >
            <Text style={[styles.sportTabText, sport === "cfb" && styles.sportTabTextActive]}>
              CFB
            </Text>
          </Pressable>
        </View>

        <View style={styles.weekPicker}>
          <Text style={styles.weekLabel}>Week</Text>
          {Platform.OS === "web" ? (
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              style={{
                padding: 8,
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                background: "white",
              } as any}
            >
              {Array.from({ length: sport === "nfl" ? 18 : 15 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          ) : (
            <Text style={{ fontWeight: "600" }}>Week {week}</Text>
          )}

          <Pressable
            style={styles.cta}
            onPress={() =>
              router.push({
                pathname: sport === "nfl" ? "/picks/page" : "/picks/college",
                params: { group: groupId, w: String(week) },
              })
            }
          >
            <Text style={styles.ctaText}>Make picks</Text>
          </Pressable>
        </View>
      </View>

      {/* Split */}
      <View style={styles.split}>
        {/* Left: weekly board */}
        <View style={styles.leftCol}>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Total Picks</Text>
              <Text style={styles.tileValue}>{total}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Most by a member</Text>
              <Text style={styles.tileValue}>{max}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.thUser}>Member</Text>
              <Text style={styles.thCount}>Week {week}</Text>
            </View>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 12 }} />
            ) : members.length === 0 ? (
              <Text style={styles.empty}>No picks yet for Week {week}. Be the first!</Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(m) => m.user_id}
                renderItem={({ item }) => {
                  const pct = max > 0 ? Math.round((item.picks_count / max) * 100) : 0;
                  return (
                    <View style={styles.tableRow}>
                      <View style={styles.userCell}>
                        {!!item.avatar_url && (
                          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                        )}
                        <Text style={styles.userName}>{item.display_name}</Text>
                      </View>
                      <View style={styles.countCell}>
                        <View style={styles.barBg}>
                          <View style={[styles.barFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.countText}>{item.picks_count}</Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>

        {/* Right: feed */}
        <View style={styles.rightCol}>
          <View style={styles.card}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>Latest picks</Text>
            {loading ? (
              <ActivityIndicator />
            ) : feed.length === 0 ? (
              <Text style={styles.empty}>No recent picks.</Text>
            ) : (
              <FlatList
                data={feed}
                keyExtractor={(f) => f.id}
                renderItem={({ item }) => (
                  <View style={styles.feedRow}>
                    {!!item.avatar_url && (
                      <Image source={{ uri: item.avatar_url }} style={styles.feedAvatar} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feedTitle}>{item.display_name} locked a pick</Text>
                      <Text style={styles.feedSub}>
                        {item.sport.toUpperCase()} • Week {item.week}
                        {item.market ? ` • ${item.market}` : ""}
                        {item.team ? ` • ${item.team}` : ""}
                        {item.line ? ` ${item.line}` : ""}
                      </Text>
                      <Text style={styles.feedTime}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </View>

      {/* Members mini table */}
      <View style={styles.card}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Members</Text>
        {roster.length === 0 ? (
          <Text style={styles.empty}>No members yet.</Text>
        ) : (
          <FlatList
            data={roster}
            keyExtractor={(r) => r.user_id}
            renderItem={({ item }) => (
              <View style={styles.tableRow}>
                <View style={styles.userCell}>
                  {!!item.avatar_url && (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                  )}
                  <Text style={styles.userName}>{item.display_name}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "800" },

  banner: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  bannerText: { color: "#9A3412" },

  controlsRow: { gap: 12, flexDirection: "column" },
  sportTabs: { flexDirection: "row", gap: 8 },
  sportTab: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#CBD5E1",
    backgroundColor: "#0B735F22",
    alignItems: "center",
  },
  sportTabActive: { backgroundColor: "#0B735F", borderColor: "#0B735F" },
  sportTabText: { fontWeight: "700", color: "#0F172A" },
  sportTabTextActive: { color: "white" },

  weekPicker: { flexDirection: "row", alignItems: "center", gap: 10 },
  weekLabel: { fontWeight: "700" },

  cta: {
    marginLeft: "auto",
    backgroundColor: "#0B735F",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaText: { color: "white", fontWeight: "800" },

  split: { flexDirection: "row", gap: 16 },
  leftCol: { flex: 1.6, gap: 12 },
  rightCol: { flex: 1, gap: 12 },

  tiles: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
  },
  tileLabel: { fontSize: 12, color: "#64748B" },
  tileValue: { fontSize: 20, fontWeight: "800", marginTop: 2 },

  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
  },

  tableHeader: { paddingVertical: 6 },
  tableRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  thUser: { flex: 1.2, fontWeight: "800" },
  thCount: { width: 140, fontWeight: "800", textAlign: "right" },

  userCell: { flex: 1.2, flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 999 },
  userName: { fontWeight: "700" },

  countCell: { width: 140, flexDirection: "row", alignItems: "center", gap: 8 },
  barBg: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  barFill: { height: 8, backgroundColor: "#0B735F" },
  countText: { width: 28, textAlign: "right", fontWeight: "800" },

  empty: { paddingVertical: 8, color: "#64748B" },

  feedRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    gap: 10,
  },
  feedAvatar: { width: 24, height: 24, borderRadius: 999, marginTop: 2 },
  feedTitle: { fontWeight: "700" },
  feedSub: { color: "#334155" },
  feedTime: { color: "#64748B", fontSize: 12, marginTop: 2 },
});
