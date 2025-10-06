// app/groups/[id]/index.tsx
export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, Pressable } from "react-native";
import { useLocalSearchParams, Link } from "expo-router";
import { supabase } from "@/lib/supabase";

type MemberRow = { user_id: string; joined_at?: string; is_owner?: boolean; display_name?: string };

type LiveWeeks = { nfl: number | null; cfb: number | null };

const SEASON = 2025;

async function getLiveWeek(league: "nfl" | "cfb"): Promise<number | null> {
  // 1) fetch all season weeks (small table, cheap)
  const { data, error } = await supabase
    .from("weeks")
    .select("week_num, opens_at, closes_at")
    .eq("league", league)
    .eq("season", SEASON)
    .order("week_num", { ascending: true });

  if (error || !data?.length) return null;

  const now = Date.now();
  // first *open* week (closes in the future)
  const open = data.find(w => Date.parse(w.opens_at) <= now && now < Date.parse(w.closes_at));
  if (open) return open.week_num;

  // else fallback to the latest available week in the season
  return data[data.length - 1].week_num ?? null;
}

export default function GroupIndex() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = typeof id === "string" ? id : null;

  const [loading, setLoading] = useState(true);
  const [liveWeeks, setLiveWeeks] = useState<LiveWeeks>({ nfl: null, cfb: null });
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [counts, setCounts] = useState<{ nfl: number; cfb: number }>({ nfl: 0, cfb: 0 });
  const [me, setMe] = useState<{ id: string | null }>({ id: null });
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Who am I?
        const { data: userData } = await supabase.auth.getUser();
        setMe({ id: userData.user?.id ?? null });

        // Resolve "live" week per league safely
        const [nflLive, cfbLive] = await Promise.all([
          getLiveWeek("nfl"),
          getLiveWeek("cfb"),
        ]);
        setLiveWeeks({ nfl: nflLive, cfb: cfbLive });

        // Group members
        if (groupId) {
          const { data: gm, error: gmErr } = await supabase
            .from("group_members")
            .select("user_id, created_at")
            .eq("group_id", groupId);
          if (!gmErr) {
            // Optionally join with a profile display name if you have a profiles table.
            const rows: MemberRow[] = (gm ?? []).map((r: any) => ({
              user_id: r.user_id,
              joined_at: r.created_at,
            }));
            setMembers(rows);
          }
        }

        // Count picks for each league limited to the resolved week
        let nflCount = 0, cfbCount = 0;
        if (groupId && nflLive != null) {
          const { data, error } = await supabase
            .from("picks")
            .select("id", { count: "exact", head: true })
            .eq("group_id", groupId)
            .eq("sport", "nfl")
            .eq("week", nflLive);
          if (!error) nflCount = data ? (data as any).length ?? 0 : (typeof (data as any) === "number" ? (data as any) : 0);
        }
        if (groupId && cfbLive != null) {
          const { data, error } = await supabase
            .from("picks")
            .select("id", { count: "exact", head: true })
            .eq("group_id", groupId)
            .eq("sport", "cfb")
            .eq("week", cfbLive);
          if (!error) cfbCount = data ? (data as any).length ?? 0 : (typeof (data as any) === "number" ? (data as any) : 0);
        }
        setCounts({ nfl: nflCount, cfb: cfbCount });

        setDebug(
          `debug: groupId=${groupId ?? "—"} · nflW=${nflLive ?? "—"} · cfbW=${cfbLive ?? "—"}`
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  const nflWeekLabel = useMemo(() => (liveWeeks.nfl != null ? `NFL (Wk ${liveWeeks.nfl})` : "NFL"), [liveWeeks.nfl]);
  const cfbWeekLabel = useMemo(() => (liveWeeks.cfb != null ? `CFB (Wk ${liveWeeks.cfb})` : "CFB"), [liveWeeks.cfb]);

  if (!groupId) {
    return (
      <View style={s.center}>
        <Text>No group id.</Text>
        <Link href="/groups">Back</Link>
      </View>
    );
  }

  if (loading) return <ActivityIndicator style={s.center} size="large" />;

  return (
    <View style={s.page}>
      <Text style={s.debug}>{debug}</Text>

      <View style={s.card}>
        <Text style={s.h2}>This Week’s Picks</Text>
        <View style={s.tableHeader}>
          <Text style={[s.th, { flex: 2 }]}>User</Text>
          <Text style={s.th}>{cfbWeekLabel}</Text>
          <Text style={s.th}>{nflWeekLabel}</Text>
        </View>

        {members.map((m) => (
          <View style={s.tr} key={m.user_id}>
            <Text style={[s.td, { flex: 2 }]}>{m.user_id}</Text>
            <Text style={s.td}>{counts.cfb}</Text>
            <Text style={s.td}>{counts.nfl}</Text>
          </View>
        ))}

        {!members.length && (
          <View style={s.tr}>
            <Text style={[s.td, { flex: 2, opacity: 0.7 }]}>No members yet</Text>
            <Text style={[s.td, { opacity: 0.7 }]}>0</Text>
            <Text style={[s.td, { opacity: 0.7 }]}>0</Text>
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.h2}>Make Your Picks</Text>

        <Text style={s.sectionLabel}>College Football</Text>
        <View style={s.row}>
          <Link
            href={{ pathname: "/picks/college", params: { group: groupId } }}
            asChild
          >
            <Pressable style={s.btn}>
              <Text style={s.btnText}>Go to CFB picks</Text>
            </Pressable>
          </Link>
        </View>

        <Text style={[s.sectionLabel, { marginTop: 14 }]}>NFL</Text>
        <View style={s.row}>
          <Link href={{ pathname: "/picks/page", params: { group: groupId } }} asChild>
            <Pressable style={s.btn}>
              <Text style={s.btnText}>Go to NFL picks</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>Members</Text>
        {members.map((m) => (
          <View style={s.tr} key={m.user_id}>
            <Text style={[s.td, { flex: 2 }]}>{m.user_id}</Text>
            <Text style={[s.td, { opacity: 0.7 }]}>{m.joined_at ? `joined ${new Date(m.joined_at).toLocaleDateString()}` : ""}</Text>
          </View>
        ))}
        {!members.length && (
          <View style={s.tr}><Text style={[s.td, { opacity: 0.7 }]}>No members</Text></View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 12, gap: 12 },
  debug: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", borderWidth: 1, padding: 8, borderRadius: 6, fontSize: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: { padding: 12, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, backgroundColor: "white", gap: 8 },
  h2: { fontSize: 16, fontWeight: "700" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 6 },
  th: { flex: 1, fontWeight: "700", color: "#6b7280" },
  tr: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  td: { flex: 1, color: "#111827" },
  sectionLabel: { fontWeight: "700", color: "#374151" },
  row: { flexDirection: "row", gap: 8 },
  btn: { backgroundColor: "#0a7cff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  btnText: { color: "white", fontWeight: "700" },
});
