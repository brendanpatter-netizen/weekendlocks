// app/index.tsx — Home: Live Picks + Leaderboard
export const unstable_settings = { prerender: false };

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";

/* ---------- Types ---------- */
type League = "nfl" | "cfb";

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

type BoardRow = { user_id: string; username: string | null; wins: number; losses: number };

/* ---------- Page ---------- */
export default function Home() {
  const [tab, setTab] = useState<"live" | "board">("live");

  // Live picks
  const [live, setLive] = useState<LiveRow[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);

  // Leaderboard
  const [boardLeague, setBoardLeague] = useState<League>("nfl");
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);

  // Fetch live picks (current open week(s))
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
  }, []);

  // Fetch leaderboard for selected league
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingBoard(true);
        const { data, error } = await supabase.rpc("leaderboard_simple", {
          p_league: boardLeague,
        });
        if (error) throw error;
        if (mounted) setBoard((data || []) as BoardRow[]);
      } catch (e) {
        console.warn(e);
      } finally {
        if (mounted) setLoadingBoard(false);
      }
    })();
    return () => { mounted = false; };
  }, [boardLeague]);

  return (
    <View style={s.screen}>
      {/* Tabs */}
      <View style={s.tabs}>
        <Pressable onPress={() => setTab("live")} style={[s.tab, tab === "live" && s.tabActive]}>
          <Text style={[s.tabText, tab === "live" && s.tabTextActive]}>Live Picks</Text>
        </Pressable>
        <View style={{ width: 8 }} />
        <Pressable onPress={() => setTab("board")} style={[s.tab, tab === "board" && s.tabActive]}>
          <Text style={[s.tabText, tab === "board" && s.tabTextActive]}>Leaderboard</Text>
        </Pressable>
      </View>

      {tab === "live" ? (
        <LivePicks loading={loadingLive} rows={live} />
      ) : (
        <>
          <View style={s.inlineLeague}>
            <Pressable onPress={() => setBoardLeague("cfb")} style={[s.inlineChip, boardLeague === "cfb" && s.inlineChipActive]}>
              <Text style={[s.inlineChipText, boardLeague === "cfb" && s.inlineChipTextActive]}>CFB</Text>
            </Pressable>
            <View style={{ width: 8 }} />
            <Pressable onPress={() => setBoardLeague("nfl")} style={[s.inlineChip, boardLeague === "nfl" && s.inlineChipActive]}>
              <Text style={[s.inlineChipText, boardLeague === "nfl" && s.inlineChipTextActive]}>NFL</Text>
            </Pressable>
          </View>
          <Leaderboard loading={loadingBoard} rows={board} />
        </>
      )}
    </View>
  );
}

/* ---------------- Live Picks ---------------- */

function LivePicks({ loading, rows }: { loading: boolean; rows: LiveRow[] }) {
  return (
    <View style={{ padding: 16 }}>
      {/* Make your picks banner */}
      <View style={s.banner}>
        <Text style={s.bannerTitle}>Make Your Picks</Text>
        <View style={s.leagueSwitchRow}>
          <Link href="/picks/college" asChild>
            <Pressable style={[s.chip, s.chipActive]}>
              <Text style={[s.chipText, s.chipTextActive]}>College Football</Text>
            </Pressable>
          </Link>
          <View style={{ width: 8 }} />
          <Link href="/picks/page" asChild>
            <Pressable style={[s.chip, s.chipActive]}>
              <Text style={[s.chipText, s.chipTextActive]}>NFL</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <Text style={[s.sectionTitle, { marginTop: 12 }]}>This Week’s Picks</Text>

      <View style={s.legendRow}>
        <Text style={[s.legend, {flex: 2}]}>User</Text>
        <Text style={[s.legend, {flex: 3, textAlign: "center"}]}>CFB</Text>
        <Text style={[s.legend, {flex: 3, textAlign: "center"}]}>NFL</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={s.dim}>No picks yet. Ask everyone to make their weekly picks!</Text>
      ) : (
        rows.map((r) => (
          <View key={r.user_id} style={[s.liveRow, { marginBottom: 10 }]}>
            <Text style={[s.user, {flex: 2}]} numberOfLines={1}>{r.username ?? "User"}</Text>

            <View style={{flex: 3}}>
              {r.cfb_pick ? (
                <>
                  <Text style={s.livePick} numberOfLines={1}>{r.cfb_pick}</Text>
                  <Text style={s.dim} numberOfLines={1}>{r.cfb_matchup}</Text>
                  {!!r.cfb_status && (
                    <View style={[s.pill, pillFor(r.cfb_status)]}>
                      <Text style={s.pillText}>{r.cfb_status.toUpperCase()}</Text>
                    </View>
                  )}
                </>
              ) : <Text style={s.dim}>—</Text>}
            </View>

            <View style={{flex: 3}}>
              {r.nfl_pick ? (
                <>
                  <Text style={s.livePick} numberOfLines={1}>{r.nfl_pick}</Text>
                  <Text style={s.dim} numberOfLines={1}>{r.nfl_matchup}</Text>
                  {!!r.nfl_status && (
                    <View style={[s.pill, pillFor(r.nfl_status)]}>
                      <Text style={s.pillText}>{r.nfl_status.toUpperCase()}</Text>
                    </View>
                  )}
                </>
              ) : <Text style={s.dim}>—</Text>}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/* ---------------- Leaderboard ---------------- */

function Leaderboard({ loading, rows }: { loading: boolean; rows: BoardRow[] }) {
  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <View style={{ padding: 16 }}>
      {rows.length === 0 ? (
        <Text style={s.dim}>No results yet.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.user_id} style={[s.leadRow, { marginBottom: 10 }]}>
            <Text style={s.user}>{r.username ?? "User"}</Text>
            <Text style={s.dim}>{r.wins}W–{r.losses}L</Text>
          </View>
        ))
      )}
    </View>
  );
}

/* ---------------- helpers + styles ---------------- */

function pillFor(status?: string | null) {
  if (!status) return s.pillGray;
  const v = status.toLowerCase();
  if (v === "win")  return s.pillGreen;
  if (v === "loss") return s.pillRed;
  if (v === "live" || v === "in_progress") return s.pillBlue;
  return s.pillGray;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F5F5" },

  tabs: { flexDirection: "row", marginTop: 8, paddingHorizontal: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff" },
  tabActive: { backgroundColor: "#111" },
  tabText: { fontWeight: "800", color: "#222" },
  tabTextActive: { color: "#fff" },

  inlineLeague: { flexDirection: "row", paddingHorizontal: 16, marginTop: 10, alignItems: "center" },
  inlineChip: { paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: "#ccc", borderRadius: 999, backgroundColor: "#fff" },
  inlineChipActive: { backgroundColor: "#E9F4EF", borderColor: "#006241" },
  inlineChipText: { fontWeight: "700", color: "#222" },
  inlineChipTextActive: { color: "#006241" },

  banner: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 16 },
  bannerTitle: { fontSize: 22, fontWeight: "900", marginBottom: 10 },
  leagueSwitchRow: { flexDirection: "row", alignItems: "center" },

  // 🔽 These were missing in your file; they fix the TS errors
  chip: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#E9F4EF", borderColor: "#006241" },
  chipText: { fontWeight: "800", color: "#222" },
  chipTextActive: { color: "#006241" },

  sectionTitle: { fontWeight: "900", fontSize: 18, marginBottom: 6 },
  legendRow: { flexDirection: "row", paddingHorizontal: 4, marginBottom: 4 },
  legend: { color: "#666", fontWeight: "700" },

  liveRow: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#eee", padding: 12, flexDirection: "row", alignItems: "flex-start" },
  user: { fontWeight: "900", color: "#111" },
  dim: { color: "#666" },
  livePick: { fontWeight: "800", color: "#222" },

  leadRow: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#eee", padding: 12, flexDirection: "row", justifyContent: "space-between" },

  pill: { alignSelf: "flex-start", marginTop: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
  pillText: { fontWeight: "800" },
  pillBlue:  { backgroundColor: "#E7F0FF" },
  pillGreen: { backgroundColor: "#E8F6EF" },
  pillRed:   { backgroundColor: "#FDECEA" },
  pillGray:  { backgroundColor: "#EEE" },
});
