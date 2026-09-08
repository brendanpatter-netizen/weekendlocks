export const unstable_settings = { prerender: false };

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getOpenWeek, type OpenWeek } from "@/lib/openWeek";
import { displayWeek } from "@/lib/weekLabel";
import { formatLine } from "@/lib/pickLabel";
import { computeLiveResult, type LiveResult } from "@/lib/liveResult";
import { logoUri } from "@/lib/teamLogos";
import { colors as theme } from "@/lib/theme";
import LockIcon from "@/components/LockIcon";
import TapeCorner from "@/components/TapeCorner";

// The Live Board pings this while it's open instead of relying on a cron —
// Vercel's Hobby plan only allows once-a-day cron, and pinging only while
// someone's actually watching is cheaper than a fixed schedule anyway
// (nobody watching costs nothing). The server-side debounce means firing
// this every 20s from every open tab still only spends Odds API credits
// once per ~25s per league, not once per tab.
const POLL_MS = 20_000;

function getTeamLogo(name: string | null | undefined, sport: "nfl" | "ncaaf"): string | null {
  if (!name) return null;
  const uri = logoUri(name, sport);
  return uri === "about:blank" ? null : uri;
}

type GameRow = {
  id: number; home: string; away: string; kickoff_at: string;
  home_score: number | null; away_score: number | null; status: string;
};
type PickRow = {
  id: string; user_id: string; display_name: string; sport: "nfl" | "cfb";
  market: string; team: string | null; line: string | null; side: string | null;
  slot: number; game_id: number | null;
};

function LiveDot() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.liveDot, { opacity: pulse }]} />;
}

function LockCard({ pick, game }: { pick: PickRow; game: GameRow | null }) {
  const league: "nfl" | "ncaaf" = pick.sport === "nfl" ? "nfl" : "ncaaf";
  const started = !!game && new Date(game.kickoff_at).getTime() <= Date.now();
  const isLive = started && game?.status !== "final";
  const isFinal = game?.status === "final";
  const result: LiveResult = game ? computeLiveResult(pick, game) : null;

  const cardStyle =
    result === "winning" ? styles.lockCardWin
    : result === "losing" ? styles.lockCardLoss
    : result === "push" ? styles.lockCardPush
    : styles.lockCardPending;

  const pickText = pick.market === "h2h" ? `${pick.team} ML` : `${pick.team} ${formatLine(pick.line)}`;

  return (
    <View style={[styles.lockCard, cardStyle]}>
      <View style={styles.lockCardHeader}>
        <Text style={styles.lockSportTag}>{pick.sport.toUpperCase()}</Text>
        {isLive && (
          <View style={styles.liveBadge}>
            <LiveDot />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
        {isFinal && (
          <Text style={[styles.resultTag, result === "winning" && styles.resultTagWin, result === "losing" && styles.resultTagLoss]}>
            {result === "winning" ? "WON" : result === "losing" ? "LOST" : result === "push" ? "PUSH" : "FINAL"}
          </Text>
        )}
      </View>

      {game ? (
        <View style={styles.matchupRow}>
          <View style={styles.teamScoreRow}>
            {!!getTeamLogo(game.away, league) && <Image source={{ uri: getTeamLogo(game.away, league)! }} style={styles.teamLogo} />}
            <Text style={styles.teamName} numberOfLines={1}>{game.away}</Text>
            <Text style={styles.scoreText}>{game.away_score ?? "–"}</Text>
          </View>
          <View style={styles.teamScoreRow}>
            {!!getTeamLogo(game.home, league) && <Image source={{ uri: getTeamLogo(game.home, league)! }} style={styles.teamLogo} />}
            <Text style={styles.teamName} numberOfLines={1}>{game.home}</Text>
            <Text style={styles.scoreText}>{game.home_score ?? "–"}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.noGameText}>Matchup not tracked yet</Text>
      )}

      <Text style={styles.pickText} numberOfLines={1}>{pickText}</Text>
      {!started && game && (
        <Text style={styles.kickoffText}>Kicks off {new Date(game.kickoff_at).toLocaleString()}</Text>
      )}
    </View>
  );
}

export default function LiveBoardPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id?.[0] : id) ?? "", [id]);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [members, setMembers] = useState<Map<string, string>>(new Map());
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [gamesById, setGamesById] = useState<Map<number, GameRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nflWeek, setNflWeek] = useState<OpenWeek | null>(null);
  const [cfbWeek, setCfbWeek] = useState<OpenWeek | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!groupId) return;
    const [nfl, cfb] = await Promise.all([getOpenWeek("nfl"), getOpenWeek("cfb")]);
    setNflWeek(nfl);
    setCfbWeek(cfb);

    const [{ data: gm }, nflPicks, cfbPicks] = await Promise.all([
      supabase.from("group_members").select("user_id").eq("group_id", groupId),
      nfl
        ? supabase.from("picks_feed").select("id, user_id, display_name, market, team, line, side, slot, game_id")
            .eq("group_id", groupId).eq("sport", "nfl").eq("week", nfl.week)
        : Promise.resolve({ data: [] as any[] }),
      cfb
        ? supabase.from("picks_feed").select("id, user_id, display_name, market, team, line, side, slot, game_id")
            .eq("group_id", groupId).eq("sport", "cfb").eq("week", cfb.week)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const rosterIds = (gm ?? []).map((r: any) => r.user_id as string);
    // picks_feed only has a display_name for members who've already picked
    // this week — a fresh week with nobody locked in yet needs the roster's
    // names from profiles directly, same lookup the group dashboard uses.
    const { data: profs } = rosterIds.length
      ? await supabase.from("profiles").select("id, display_name, username").in("id", rosterIds)
      : { data: [] as any[] };
    const roster = new Map<string, string>(
      rosterIds.map((uid) => {
        const p = (profs ?? []).find((x: any) => x.id === uid);
        return [uid, p?.username || p?.display_name || uid];
      })
    );
    const allPicks: PickRow[] = [
      ...(nflPicks.data ?? []).map((p: any) => ({ ...p, sport: "nfl" as const })),
      ...(cfbPicks.data ?? []).map((p: any) => ({ ...p, sport: "cfb" as const })),
    ];
    setMembers(roster);
    setPicks(allPicks);

    const gameIds = Array.from(new Set(allPicks.map((p) => p.game_id).filter((x): x is number => x != null)));
    if (gameIds.length) {
      const { data: gamesData } = await supabase
        .from("games")
        .select("id, home, away, kickoff_at, home_score, away_score, status")
        .in("id", gameIds);
      setGamesById(new Map((gamesData ?? []).map((g: any) => [g.id, g])));
    } else {
      setGamesById(new Map());
    }
    setLastUpdated(Date.now());
    setLoading(false);
  }, [groupId]);

  // Nudge the backend to refresh live scores — harmless (and free) if
  // nothing's actually live right now; see api/_lib/refreshLiveScores.js.
  const pingLiveScores = useCallback(async () => {
    if (!accessToken) return;
    try {
      await fetch("/api/live-scores", { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch {
      // best-effort — the board still shows whatever's already in the DB
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const tick = async () => {
      await pingLiveScores();
      if (!cancelled) await load();
    };
    const interval = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [accessToken, pingLiveScores, load]);

  const picksByUser = useMemo(() => {
    const map = new Map<string, PickRow[]>();
    picks.forEach((p) => {
      const list = map.get(p.user_id) ?? [];
      list.push(p);
      map.set(p.user_id, list);
    });
    return map;
  }, [picks]);

  const memberRows = useMemo(
    () => Array.from(members.entries())
      .map(([user_id, display_name]) => ({ user_id, display_name, picks: picksByUser.get(user_id) ?? [] }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })),
    [members, picksByUser]
  );

  const secondsAgo = lastUpdated ? Math.max(0, Math.round((Date.now() - lastUpdated) / 1000)) : null;

  return (
    <ScrollView style={styles.pageOuter} contentContainerStyle={styles.page}>
      <View style={styles.pageHeader}>
        <View style={styles.pageTitleRow}>
          <LockIcon size={22} color="#F5F3E7" />
          <Text style={styles.pageTitle}>Live Board</Text>
        </View>
        <Pressable onPress={() => router.push(`/groups/${groupId}` as Href)} style={styles.backChip}>
          <Text style={styles.backChipText}>Back to group</Text>
        </Pressable>
      </View>

      <Text style={styles.subheading}>
        {nflWeek ? `NFL Week ${displayWeek(nflWeek.week)}` : "NFL not live"}
        {"  ·  "}
        {cfbWeek ? `CFB Week ${displayWeek(cfbWeek.week)}` : "CFB not live"}
        {secondsAgo != null && `  ·  updated ${secondsAgo}s ago`}
      </Text>

      {loading ? (
        <Text style={styles.emptyText}>Loading the board…</Text>
      ) : memberRows.length === 0 ? (
        <View style={styles.noLiveWeek}>
          <TapeCorner />
          <Text style={styles.noLiveWeekTitle}>No locks yet</Text>
          <Text style={styles.noLiveWeekBody}>Once the crew locks in picks for a live week, they'll show up here.</Text>
        </View>
      ) : (
        memberRows.map((m) => (
          <View key={m.user_id} style={styles.memberCard}>
            <Text style={styles.memberName}>{m.display_name}</Text>
            {m.picks.length === 0 ? (
              <Text style={styles.noPickText}>No lock this week</Text>
            ) : (
              <View style={styles.lockRow}>
                {m.picks.map((p) => (
                  <LockCard key={p.id} pick={p} game={p.game_id ? gamesById.get(p.game_id) ?? null : null} />
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageOuter: { flex: 1, backgroundColor: theme.felt },
  page: { padding: 16, gap: 12, paddingBottom: 24 },

  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pageTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  pageTitle: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 26, color: "#F5F3E7", flexShrink: 1 },
  backChip: {
    borderWidth: 1.5, borderColor: "rgba(245,243,231,0.4)", borderStyle: "dashed",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  backChipText: { color: "#F5F3E7", fontWeight: "800", fontSize: 12, letterSpacing: 0.3 },
  subheading: { color: "rgba(245,243,231,0.75)", fontSize: 12, fontWeight: "700" },
  emptyText: { color: "#F5F3E7", marginTop: 12 },

  noLiveWeek: {
    position: "relative", alignItems: "center", gap: 4, backgroundColor: "#F5F3E7",
    borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed", borderRadius: 10,
    padding: 24, marginTop: 8,
  },
  noLiveWeekTitle: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 18, color: "#B23A2E" },
  noLiveWeekBody: { color: "#45564C", fontSize: 13, textAlign: "center", fontWeight: "700" },

  memberCard: {
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)",
    borderRadius: 12, padding: 12, gap: 8,
  },
  memberName: { fontWeight: "800", fontSize: 15, color: "#0C1712" },
  noPickText: { color: "#94A3B8", fontSize: 13, fontStyle: "italic" },
  lockRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  lockCard: {
    flexGrow: 1, flexBasis: 220, minWidth: 200, borderRadius: 10, borderWidth: 1.5,
    padding: 10, gap: 6,
  },
  lockCardPending: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  lockCardWin: { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" },
  lockCardLoss: { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
  lockCardPush: { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" },

  lockCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lockSportTag: { fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.5 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "#DC2626" },
  liveBadgeText: { fontSize: 10, fontWeight: "800", color: "#DC2626", letterSpacing: 0.5 },
  resultTag: { fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.5 },
  resultTagWin: { color: "#166534" },
  resultTagLoss: { color: "#991B1B" },

  matchupRow: { gap: 2 },
  teamScoreRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  teamLogo: { width: 16, height: 16, resizeMode: "contain" },
  teamName: { flex: 1, fontSize: 12, fontWeight: "700", color: "#0C1712" },
  scoreText: { fontSize: 13, fontWeight: "800", color: "#0C1712", minWidth: 18, textAlign: "right" },
  noGameText: { fontSize: 12, color: "#94A3B8", fontStyle: "italic" },

  pickText: { fontSize: 12, fontWeight: "700", color: "#45564C" },
  kickoffText: { fontSize: 10, color: "#94A3B8" },
});
