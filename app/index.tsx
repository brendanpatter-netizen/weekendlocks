// app/index.tsx — Home: All Picks | Leaderboard | Live Picks
export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from "react-native";
import { supabase } from "@/lib/supabase";
import { Link } from "expo-router";

/* ---------- Types ---------- */
type League = "nfl" | "cfb";

type FeedRow = {
  id: number | string;
  created_at: string;
  pick_team: string | null;
  sport: string | null;
  week: number | null;
  status: string | null;
  profiles?: { username?: string | null } | null;
  games?: { home: string; away: string; kickoff_at: string; status: "scheduled"|"in_progress"|"final" } | null;
};

type BoardRow = { user_id: string; username: string | null; wins: number; losses: number };

type LiveRow = {
  user_id: string;
  username: string | null;
  nfl_week: number | null;
  nfl_pick: string | null;
  nfl_matchup: string | null;
  nfl_status: string | null;
  nfl_kickoff: string | null;
  cfb_week: number | null;
  cfb_pick: string | null;
  cfb_matchup: string | null;
  cfb_status: string | null;
  cfb_kickoff: string | null;
};

/* ---------- Page ---------- */
export default function Home() {
  const [tab, setTab] = useState<"feed" | "board" | "live">("live");
  const [league, setLeague] = useState<League>("nfl");
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [live, setLive] = useState<LiveRow[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);

  // Feed + leaderboard (same as before)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("picks")
          .select(`
            id, created_at, pick_team, sport, week, status,
            profiles:profiles!picks_user_id_fkey ( username ),
            games:games!picks_game_id_fkey ( home, away, kickoff_at, status )
          `)
          .eq("sport", league)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        if (mounted) setFeed((data || []) as any[]);

        const { data: boardRows } = await supabase.rpc("leaderboard_simple", {
          p_league: league,
        });
        if (mounted) setBoard((boardRows || []) as any[]);
      } catch (e) {
        console.warn(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [league]);

  // Live picks (new)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingLive(true);
        const { data, error } = await supabase.rpc("live_picks_both");
        if (error) throw error;
        if (mounted) setLive((data || []) as LiveRow[]);
      } catch (e) {
        console.warn(e);
      } finally {
        if (mounted) setLoadingLive(false);
      }
    })();
    return () => { mounted = false; };
  }, []); // refresh on pull-to-refresh if you add it

  return (
    <View style={s.screen}>
      {/* Tabs */}
      <View style={s.tabs}>
        {(["live","feed","board"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === "live" ? "Live Picks" : t === "feed" ? "All Picks" : "Leaderboard"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Quick league toggle for Feed/Board */}
      {tab !== "live" && (
        <View style={s.inlineLeague}>
          <Pressable onPress={() => setLeague("cfb")} style={[s.inlineChip, league === "cfb" && s.inlineChipActive]}>
            <Text style={[s.inlineChipText, league === "cfb" && s.inlineChipTextActive]}>CFB</Text>
          </Pressable>
          <Pressable onPress={() => setLeague("nfl")} style={[s.inlineChip, league === "nfl" && s.inlineChipActive]}>
            <Text style={[s.inlineChipText, league === "nfl" && s.inlineChipTextActive]}>NFL</Text>
          </Pressable>
        </View>
      )}

      {tab === "live" ? (
        <LivePicks loading={loadingLive} rows={live} />
      ) : tab === "feed" ? (
        loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : (
          <FlatList
            ListHeaderComponent={<MakeYourPicksBanner />}
            data={feed}
            keyExtractor={(r) => String(r.id)}
            renderItem={({ item }) => <FeedItem row={item} />}
            contentContainerStyle={{ padding: 16, gap: 12 }}
          />
        )
      ) : (
        <Leaderboard loading={loading} rows={board} />
      )}
    </View>
  );
}

/* ---------- Components ---------- */

function MakeYourPicksBanner() {
  return (
    <View style={s.banner}>
      <Text style={s.bannerTitle}>Make Your Picks</Text>
      <View style={s.leagueSwitch}>
        <Link href="/picks/college" asChild>
          <Pressable style={[s.chip, s.chipActive]}><Text style={[s.chipText, s.chipTextActive]}>College Football</Text></Pressable>
        </Link>
        <Link href="/picks/page" asChild>
          <Pressable style={[s.chip, s.chipActive]}><Text style={[s.chipText, s.chipTextActive]}>NFL</Text></Pressable>
        </Link>
      </View>
    </View>
  );
}

function FeedItem({ row }: { row: FeedRow }) {
  const user = row.profiles?.username ?? "Someone";
  const g = row.games;
  const when = timeAgo(row.created_at);
  let statusText = "";
  let statusStyle = s.pillGray;
  if (g?.status === "in_progress") { statusText = "LIVE"; statusStyle = s.pillBlue; }
  else if (row.status === "win")   { statusText = "WON";  statusStyle = s.pillGreen; }
  else if (row.status === "loss")  { statusText = "LOST"; statusStyle = s.pillRed; }
  else if (g?.kickoff_at)         { statusText = new Date(g.kickoff_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

  return (
    <View style={s.card}>
      <Text style={s.userRow}><Text style={s.user}>{user}</Text><Text style={s.dim}>  {when}</Text></Text>
      <Text style={s.main}>
        {row.pick_team}{g ? ` — ${g.away} vs ${g.home}` : ""}
      </Text>
      {statusText ? <Text style={[s.pill, statusStyle]}>{statusText}</Text> : null}
    </View>
  );
}

function Leaderboard({ loading, rows }: { loading: boolean; rows: BoardRow[] }) {
  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;
  return (
    <View style={{ padding: 16, gap: 10 }}>
      {rows.length === 0 ? <Text style={s.dim}>No results yet.</Text> :
        rows.map((r) => (
          <View key={r.user_id} style={s.leadRow}>
            <Text style={s.user}>{r.username ?? "User"}</Text>
            <Text style={s.dim}>{r.wins}W–{r.losses}L</Text>
          </View>
      ))}
    </View>
  );
}

function LivePicks({ loading, rows }: { loading: boolean; rows: LiveRow[] }) {
  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={s.sectionTitle}>This Week’s Picks</Text>
      <View style={s.legendRow}>
        <Text style={[s.legend, {flex: 2}]}>User</Text>
        <Text style={[s.legend, {flex: 3}]}>CFB</Text>
        <Text style={[s.legend, {flex: 3}]}>NFL</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={s.dim}>No picks yet. Ask everyone to make their weekly picks!</Text>
      ) : rows.map((r) => (
        <View key={r.user_id} style={s.liveRow}>
          <Text style={[s.user, {flex: 2}]} numberOfLines={1}>{r.username ?? "User"}</Text>

          <View style={{flex: 3}}>
            {r.cfb_pick ? (
              <>
                <Text style={s.livePick} numberOfLines={1}>{r.cfb_pick}</Text>
                <Text style={s.dim} numberOfLines={1}>{r.cfb_matchup}</Text>
                {r.cfb_status ? <Text style={[s.pill, pillFor(r.cfb_status)]}>{r.cfb_status.toUpperCase()}</Text> : null}
              </>
            ) : <Text style={s.dim}>—</Text>}
          </View>

          <View style={{flex: 3}}>
            {r.nfl_pick ? (
              <>
                <Text style={s.livePick} numberOfLines={1}>{r.nfl_pick}</Text>
                <Text style={s.dim} numberOfLines={1}>{r.nfl_matchup}</Text>
                {r.nfl_status ? <Text style={[s.pill, pillFor(r.nfl_status)]}>{r.nfl_status.toUpperCase()}</Text> : null}
              </>
            ) : <Text style={s.dim}>—</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------- helpers ---------- */
function pillFor(status?: string | null) {
  if (!status) return s.pillGray;
  const v = status.toLowerCase();
  if (v === "win")  return s.pillGreen;
  if (v === "loss") return s.pillRed;
  if (v === "live" || v === "in_progress") return s.pillBlue;
  return s.pillGray;
}

function timeAgo(iso: string) {
  const d = Date.now() - Date.parse(iso);
  const m = Math.floor(d / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

/* ---------- styles ---------- */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F5F5" },

  tabs: { flexDirection: "row", marginTop: 8, paddingHorizontal: 16, gap: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff" },
  tabActive: { backgroundColor: "#111" },
  tabText: { fontWeight: "800", color: "#222" },
  tabTextActive: { color: "#fff" },

  inlineLeague: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 10 },
  inlineChip: { paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: "#ccc", borderRadius: 999, backgroundColor: "#fff" },
  inlineChipActive: { backgroundColor: "#E9F4EF", borderColor: "#006241" },
  inlineChipText: { fontWeight: "700", color: "#222" },
  inlineChipTextActive: { color: "#006241" },

  banner: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 16, marginHorizontal: 16, marginTop: 12 },
  bannerTitle: { fontSize: 22, fontWeight: "900", marginBottom: 10 },
  leagueSwitch: { flexDirection: "row", gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#E9F4EF", borderColor: "#006241" },
  chipText: { fontWeight: "800", color: "#222" },
  chipTextActive: { color: "#006241" },

  card: { marginTop: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#eee", padding: 12, marginHorizontal: 16, gap: 6 },
  userRow: { fontSize: 14 },
  user: { fontWeight: "900", color: "#111" },
  dim: { color: "#666" },
  main: { fontSize: 16, fontWeight: "600", color: "#222" },

  pill: { alignSelf: "flex-start", marginTop: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, fontWeight: "800" } as any,
  pillBlue:  { backgroundColor: "#E7F0FF", color: "#0055CC" },
  pillGreen: { backgroundColor: "#E8F6EF", color: "#0F7B3E" },
  pillRed:   { backgroundColor: "#FDECEA", color: "#B71C1C" },
  pillGray:  { backgroundColor: "#EEE", color: "#444" },

  leadRow: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#eee", padding: 12, marginHorizontal: 16, flexDirection: "row", justifyContent: "space-between" },

  sectionTitle: { fontWeight: "900", fontSize: 18, marginBottom: 6 },
  legendRow: { flexDirection: "row", paddingHorizontal: 4, marginBottom: 4 },
  legend: { color: "#666", fontWeight: "700" },
  liveRow: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#eee", padding: 12, gap: 6, flexDirection: "row", alignItems: "flex-start" },
  livePick: { fontWeight: "800", color: "#222" },
});
