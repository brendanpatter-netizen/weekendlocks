// app/index.tsx — Home: Live Picks + Leaderboard (refreshes when picks are saved)
export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { events } from "@/lib/events";

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

export default function Home() {
  const [tab, setTab] = useState<"live" | "board">("live");

  // Live picks
  const [live, setLive] = useState<LiveRow[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number | null>(null);

  // Leaderboard
  const [boardLeague, setBoardLeague] = useState<League>("nfl");
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);

  const fetchLive = async () => {
    setLoadingLive(true);
    try {
      const { data, error } = await supabase.rpc("live_picks_both");
      if (error) throw error;
      setLive((data || []) as LiveRow[]);
      setLiveUpdatedAt(Date.now());
    } finally {
      setLoadingLive(false);
    }
  };

  const fetchBoard = async (league: League) => {
    setLoadingBoard(true);
    try {
      const { data, error } = await supabase.rpc("leaderboard_simple", { p_league: league });
      if (error) throw error;
      setBoard((data || []) as BoardRow[]);
    } finally {
      setLoadingBoard(false);
    }
  };

  useEffect(() => { fetchLive(); }, []);
  useEffect(() => { fetchBoard(boardLeague); }, [boardLeague]);

  // 🔔 same-tab instant update when a pick is saved on a Picks page
  useEffect(() => {
    const off = events.onPickSaved(() => { fetchLive(); });
    return off;
  }, []);

  // 🔁 optional: cross-tab / other users via Supabase Realtime
  useEffect(() => {
    const ch = supabase
      .channel("picks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "picks" }, () => {
        fetchLive();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updatedAgo = useMemo(() => {
    if (!liveUpdatedAt) return null;
    const m = Math.floor((Date.now() - liveUpdatedAt) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }, [liveUpdatedAt]);

  return (
    <View style={s.screen}>
      {/* Tabs */}
      <View style={s.tabs}>
        <Pressable onPress={() => setTab("live")} style={tab === "live" ? [s.tab, s.tabActive] : s.tab}>
          <Text style={tab === "live" ? [s.tabText, s.tabTextActive] : s.tabText}>Live Picks</Text>
        </Pressable>
        <View style={{ width: 8 }} />
        <Pressable onPress={() => setTab("board")} style={tab === "board" ? [s.tab, s.tabActive] : s.tab}>
          <Text style={tab === "board" ? [s.tabText, s.tabTextActive] : s.tabText}>Leaderboard</Text>
        </Pressable>
      </View>

      {tab === "live" ? (
        <LivePicks loading={loadingLive} rows={live} onRefresh={fetchLive} updatedAgo={updatedAgo} />
      ) : (
        <>
          <View style={s.inlineLeague}>
            <Pressable onPress={() => setBoardLeague("cfb")} style={boardLeague === "cfb" ? [s.inlineChip, s.inlineChipActive] : s.inlineChip}>
              <Text style={boardLeague === "cfb" ? [s.inlineChipText, s.inlineChipTextActive] : s.inlineChipText}>CFB</Text>
            </Pressable>
            <View style={{ width: 8 }} />
            <Pressable onPress={() => setBoardLeague("nfl")} style={boardLeague === "nfl" ? [s.inlineChip, s.inlineChipActive] : s.inlineChip}>
              <Text style={boardLeague === "nfl" ? [s.inlineChipText, s.inlineChipTextActive] : s.inlineChipText}>NFL</Text>
            </Pressable>
          </View>
          <Leaderboard loading={loadingBoard} rows={board} />
        </>
      )}
    </View>
  );
}

/* -------- Live Picks -------- */

function LivePicks({
  loading, rows, onRefresh, updatedAgo,
}: {
  loading: boolean;
  rows: LiveRow[];
  onRefresh: () => void;
  updatedAgo: string | null;
}) {
  return (
    <View style={{ padding: 16 }}>
      {/* Banner */}
      <View style={s.banner}>
        <Text style={s.bannerTitle}>Make Your Picks</Text>
        <View style={s.leagueSwitchRow}>
          <Link href="/picks/college" prefetch={false} asChild>
            <Pressable style={s.ctaBtnPrimary}>
              <Text style={s.ctaBtnPrimaryText}>College Football</Text>
            </Pressable>
          </Link>
          <View style={{ width: 8 }} />
          <Link href="/picks/page" prefetch={false} asChild>
            <Pressable style={s.ctaBtnPrimary}>
              <Text style={s.ctaBtnPrimaryText}>NFL</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {/* Header + refresh */}
      <View style={s.refreshRow}>
        <Text style={s.sectionTitle}>This Week’s Picks</Text>
        <Pressable onPress={onRefresh} disabled={loading} style={loading ? [s.refreshBtn, s.refreshBtnDisabled] : s.refreshBtn}>
          <Text style={s.refreshBtnText}>{loading ? "Refreshing…" : "Refresh ↻"}</Text>
        </Pressable>
      </View>
      {updatedAgo && <Text style={[s.dim, { marginBottom: 8 }]}>Updated {updatedAgo}</Text>}

      {/* Table header */}
      <View style={s.legendRow}>
        <Text style={[s.legend, {flex: 2}]}>User</Text>
        <Text style={[s.legend, {flex: 3, textAlign: "center"}]}>CFB</Text>
        <Text style={[s.legend, {flex: 3, textAlign: "center"}]}>NFL</Text>
      </View>

      {/* Rows */}
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
                  {r.cfb_status ? (
                    <View style={[s.pill, pillFor(r.cfb_status)]}><Text style={s.pillText}>{r.cfb_status.toUpperCase()}</Text></View>
                  ) : null}
                </>
              ) : <Text style={s.dim}>—</Text>}
            </View>

            <View style={{flex: 3}}>
              {r.nfl_pick ? (
                <>
                  <Text style={s.livePick} numberOfLines={1}>{r.nfl_pick}</Text>
                  <Text style={s.dim} numberOfLines={1}>{r.nfl_matchup}</Text>
                  {r.nfl_status ? (
                    <View style={[s.pill, pillFor(r.nfl_status)]}><Text style={s.pillText}>{r.nfl_status.toUpperCase()}</Text></View>
                  ) : null}
                </>
              ) : <Text style={s.dim}>—</Text>}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/* -------- Leaderboard -------- */

function Leaderboard({ loading, rows }: { loading: boolean; rows: BoardRow[] }) {
  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;
  return (
    <View style={{ padding: 16 }}>
      {rows.length === 0 ? (
        <Text style={s.dim}>No results yet.</Text>
      ) : rows.map((r) => (
        <View key={r.user_id} style={[s.leadRow, { marginBottom: 10 }]}>
          <Text style={s.user}>{r.username ?? "User"}</Text>
          <Text style={s.dim}>{r.wins}W–{r.losses}L</Text>
        </View>
      ))}
    </View>
  );
}

/* -------- helpers + styles -------- */

function pillFor(status?: string | null) {
  if (!status) return s.pillGray;
  const v = status.toLowerCase();
  if (v === "win") return s.pillGreen;
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

  // CTA buttons
  ctaBtnPrimary: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#006241", backgroundColor: "#E9F4EF" },
  ctaBtnPrimaryText: { fontWeight: "800", color: "#006241" },

  refreshRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  refreshBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", backgroundColor: "#fff" },
  refreshBtnDisabled: { opacity: 0.5 },
  refreshBtnText: { fontWeight: "800", color: "#222" },

  sectionTitle: { fontWeight: "900", fontSize: 18 },

  legendRow: { flexDirection: "row", paddingHorizontal: 4, marginTop: 8, marginBottom: 4 },
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
