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
  FlatList,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";

type MemberRow = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url?: string | null;
};

type LiveWeeks = { nfl: number; cfb: number };

const SEASON = 2025;

/** Safely compute a “live” week for a league from the weeks table.
 * If nothing is open yet, fall back to the latest week of the season.
 * If the table is empty/missing, fall back to week 1.
 */
async function getLiveWeek(league: "nfl" | "cfb"): Promise<number> {
  const { data, error } = await supabase
    .from("weeks")
    .select("week_num, opens_at, closes_at, season, league")
    .eq("league", league)
    .eq("season", SEASON)
    .order("week_num", { ascending: true });

  if (error || !data?.length) return 1;

  const now = Date.now();
  const open = data.find(
    (w) => Date.parse(w.opens_at as any) <= now && now < Date.parse(w.closes_at as any)
  );
  if (open) return open.week_num as number;

  return (data[data.length - 1].week_num as number) ?? 1;
}

export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id?.[0] : id) ?? "", [id]);

  const [groupName, setGroupName] = useState<string>("WeekendLocks");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [weeks, setWeeks] = useState<LiveWeeks>({ nfl: 1, cfb: 1 });
  const [counts, setCounts] = useState<{ nfl: number; cfb: number }>({ nfl: 0, cfb: 0 });

  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;

    (async () => {
      try {
        setLoading(true);
        setBanner(null);

        // Group name (optional)
        const { data: g } = await supabase
          .from("groups")
          .select("name")
          .eq("id", groupId)
          .maybeSingle();
        if (g?.name) setGroupName(g.name);

        // Resolve safe “live” weeks
        const [nflW, cfbW] = await Promise.all([getLiveWeek("nfl"), getLiveWeek("cfb")]);
        setWeeks({ nfl: nflW, cfb: cfbW });

        // --- Members ---
        // 1) Try consolidated view
        const byView = await supabase
          .from("group_member_profiles")
          .select("user_id, role, joined_at, display_name, username, avatar_url")
          .eq("group_id", groupId)
          .order("joined_at", { ascending: true });

        if (!byView.error && (byView.data?.length ?? 0) > 0) {
          setMembers(byView.data as MemberRow[]);
        } else {
          // 2) Fallback: group_members → profiles (two-step join)
          const { data: gm, error: gmErr } = await supabase
            .from("group_members")
            .select("user_id, role, joined_at")
            .eq("group_id", groupId)
            .order("joined_at", { ascending: true });

          if (gmErr) {
            setMembers([]);
          } else {
            const ids = [...new Set((gm ?? []).map((r) => r.user_id))];
            let profiles: Record<string, { username: string | null; avatar_url: string | null }> =
              {};
            if (ids.length) {
              const { data: pf } = await supabase
                .from("profiles")
                .select("id, username, avatar_url")
                .in("id", ids);
              for (const p of pf ?? []) {
                profiles[p.id] = { username: p.username ?? null, avatar_url: p.avatar_url ?? null };
              }
            }
            const mapped: MemberRow[] = (gm ?? []).map((r: any) => ({
              user_id: r.user_id,
              role: r.role ?? null,
              joined_at: r.joined_at ?? null,
              display_name: profiles[r.user_id]?.username ?? r.user_id,
              username: profiles[r.user_id]?.username ?? null,
              avatar_url: profiles[r.user_id]?.avatar_url ?? null,
            }));
            setMembers(mapped);
          }
        }

        // --- Counts ---
        // NFL
        const nflHead = await supabase
          .from("picks")
          .select("*", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("week", nflW)
          .or("sport.eq.nfl,league.eq.nfl"); // support enum or legacy column
        if (nflHead.error) setBanner((b) => (b ? b + " | " : "") + `[NFL] ${nflHead.error.message}`);
        // The count is exposed on `count` for head requests
        setCounts((c) => ({ ...c, nfl: nflHead.count ?? 0 }));

        // CFB
        const cfbHead = await supabase
          .from("picks")
          .select("*", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("week", cfbW)
          .or("sport.eq.cfb,league.eq.cfb");
        if (cfbHead.error) setBanner((b) => (b ? b + " | " : "") + `[CFB] ${cfbHead.error.message}`);
        setCounts((c) => ({ ...c, cfb: cfbHead.count ?? 0 }));
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

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;

  const nflWeekLabel = `NFL (Wk ${weeks.nfl})`;
  const cfbWeekLabel = `CFB (Wk ${weeks.cfb})`;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{groupName}</Text>

      <View style={styles.debug}>
        <Text style={styles.debugText}>
          debug: groupId={groupId} · nflW={weeks.nfl} · cfbW={weeks.cfb}
          {banner ? ` · ${banner}` : ""}
        </Text>
      </View>

      {/* This Week’s Picks */}
      <View style={styles.card}>
        <Text style={styles.h2}>This Week’s Picks</Text>

        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cellUser, styles.headerText]}>User</Text>
          <Text style={[styles.cell, styles.headerText, styles.centerText]}>{cfbWeekLabel}</Text>
          <Text style={[styles.cell, styles.headerText, styles.centerText]}>{nflWeekLabel}</Text>
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
                {/* Group-wide weekly totals for now (per-user breakdown later) */}
                <Text style={[styles.cell, styles.centerText]}>{counts.cfb}</Text>
                <Text style={[styles.cell, styles.centerText]}>{counts.nfl}</Text>
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
          onPress={() => router.push({ pathname: "/picks/college", params: { group: groupId } })}
        >
          <Text style={styles.ctaText}>Go to CFB picks</Text>
        </Pressable>

        <Text style={[styles.h3, { marginTop: 18 }]}>NFL</Text>
        <Pressable
          style={styles.cta}
          onPress={() => router.push({ pathname: "/picks/page", params: { group: groupId } })}
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
