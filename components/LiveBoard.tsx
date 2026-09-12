// components/LiveBoard.tsx
// Embedded in the group dashboard instead of a separate page — opening the
// group page at all is the "opt-in" signal that drives live-score polling
// (see api/_lib/refreshLiveScores.js), so folding this in here just makes
// that signal fire on a page people already have open, no extra click
// needed. Collapses to a one-line teaser when nothing's actually live so
// the dashboard isn't cluttered the other 5 days of the week, and expands
// automatically the moment something kicks off.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { getOpenWeek, type OpenWeek } from "@/lib/openWeek";
import { displayWeek } from "@/lib/weekLabel";
import { formatLine } from "@/lib/pickLabel";
import { computeLiveResult, type LiveResult } from "@/lib/liveResult";
import { fetchGameClocks, findGameClock, type GameClock } from "@/lib/gameClock";
import { logoUri } from "@/lib/teamLogos";
import LiveIcon from "@/components/LiveIcon";
import TapeCorner from "@/components/TapeCorner";

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
  id: string; user_id: string; sport: "nfl" | "cfb";
  market: string; team: string | null; line: string | null; side: string | null;
  slot: number; game_id: number | null;
};

function gameStarted(g: GameRow): boolean {
  return new Date(g.kickoff_at).getTime() <= Date.now();
}

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

function LockCard({ pick, game, clocks }: { pick: PickRow; game: GameRow | null; clocks: GameClock[] }) {
  const league: "nfl" | "ncaaf" = pick.sport === "nfl" ? "nfl" : "ncaaf";
  const started = !!game && gameStarted(game);
  const isLive = started && game?.status !== "final";
  const isFinal = game?.status === "final";
  const result: LiveResult = game ? computeLiveResult(pick, game) : null;
  // ESPN-only, and unofficial — see lib/gameClock.ts. No match (or the fetch
  // having failed entirely) just means no clock line, never a broken card.
  const clock = isLive && game ? findGameClock(clocks, game.home, game.away, pick.sport) : null;

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
            <Text style={styles.liveBadgeText}>{clock?.label || "LIVE"}</Text>
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

export default function LiveBoard({ groupId }: { groupId: string }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [members, setMembers] = useState<Map<string, string>>(new Map());
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [gamesById, setGamesById] = useState<Map<number, GameRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nflWeek, setNflWeek] = useState<OpenWeek | null>(null);
  const [cfbWeek, setCfbWeek] = useState<OpenWeek | null>(null);
  const [nflClocks, setNflClocks] = useState<GameClock[]>([]);
  const [cfbClocks, setCfbClocks] = useState<GameClock[]>([]);
  // null = follow live state automatically; true/false = the user overrode it.
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? null));
    // getSession() alone only captures the token present at mount — the
    // client rotates it in the background (autoRefreshToken), and without
    // this listener the stale original token silently 401s once it expires,
    // freezing pingLiveScores forever with no visible error.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!groupId) return;
    const [nfl, cfb] = await Promise.all([getOpenWeek("nfl"), getOpenWeek("cfb")]);
    setNflWeek(nfl);
    setCfbWeek(cfb);

    const [{ data: gm }, nflPicks, cfbPicks] = await Promise.all([
      supabase.from("group_members").select("user_id").eq("group_id", groupId),
      nfl
        ? supabase.from("picks_feed").select("id, user_id, market, team, line, side, slot, game_id")
            .eq("group_id", groupId).eq("sport", "nfl").eq("week", nfl.week)
        : Promise.resolve({ data: [] as any[] }),
      cfb
        ? supabase.from("picks_feed").select("id, user_id, market, team, line, side, slot, game_id")
            .eq("group_id", groupId).eq("sport", "cfb").eq("week", cfb.week)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const rosterIds = (gm ?? []).map((r: any) => r.user_id as string);
    // picks_feed only has a name for members who've already picked this
    // week — a fresh week with nobody locked in yet needs the roster's
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

  // Separate, free, uncredited source (see lib/gameClock.ts) — a failure
  // here just leaves the previous clocks in place rather than blocking the
  // score refresh above, since the two have nothing to do with each other.
  const loadClocks = useCallback(async () => {
    try {
      const [nfl, cfb] = await Promise.all([fetchGameClocks("nfl"), fetchGameClocks("cfb")]);
      setNflClocks(nfl);
      setCfbClocks(cfb);
    } catch {
      // best-effort — cards just show "LIVE" instead of a quarter/clock
    }
  }, []);

  useEffect(() => {
    load();
    loadClocks();
  }, [load, loadClocks]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const tick = async () => {
      await Promise.all([pingLiveScores(), loadClocks()]);
      if (!cancelled) await load();
    };
    const interval = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [accessToken, pingLiveScores, loadClocks, load]);

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

  const trackedGames = useMemo(
    () => Array.from(new Set(picks.map((p) => p.game_id).filter((x): x is number => x != null)))
      .map((id) => gamesById.get(id))
      .filter((g): g is GameRow => !!g),
    [picks, gamesById]
  );
  const liveCount = trackedGames.filter((g) => gameStarted(g) && g.status !== "final").length;
  const anyLive = liveCount > 0;
  const expanded = manualExpanded ?? anyLive;

  const nextKickoff = useMemo(() => {
    const upcoming = trackedGames
      .filter((g) => !gameStarted(g))
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())[0];
    return upcoming ? new Date(upcoming.kickoff_at) : null;
  }, [trackedGames]);

  const secondsAgo = lastUpdated ? Math.max(0, Math.round((Date.now() - lastUpdated) / 1000)) : null;

  const collapsedSubtitle = loading
    ? "Loading…"
    : memberRows.every((m) => m.picks.length === 0)
    ? "No locks yet this week"
    // Reachable only via manual override — anyLive normally forces expanded
    // — but still needs to say so accurately rather than falling through to
    // "graded" just because there's no game left to call "next."
    : anyLive
    ? `${liveCount} game${liveCount === 1 ? "" : "s"} live right now`
    : nextKickoff
    ? `Next kickoff ${nextKickoff.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`
    : "This week's locks are graded";

  return (
    <View style={styles.card}>
      <TapeCorner side="right" />
      <Pressable
        onPress={() => setManualExpanded(!expanded)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Collapse Live Board" : "Expand Live Board"}
      >
        <View style={styles.titleRow}>
          <LiveIcon size={17} color="#B23A2E" />
          <Text style={styles.cardTitle}>Live Board</Text>
          {anyLive && (
            <View style={styles.liveCountBadge}>
              <LiveDot />
              <Text style={styles.liveCountText}>{liveCount} live</Text>
            </View>
          )}
        </View>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>

      {!expanded ? (
        <Text style={styles.collapsedSubtitle}>{collapsedSubtitle}</Text>
      ) : (
        <>
          <Text style={styles.subheading}>
            {nflWeek ? `NFL Week ${displayWeek(nflWeek.week, "nfl")}` : "NFL not live"}
            {"  ·  "}
            {cfbWeek ? `CFB Week ${displayWeek(cfbWeek.week, "cfb")}` : "CFB not live"}
            {secondsAgo != null && `  ·  updated ${secondsAgo}s ago`}
          </Text>

          {loading ? (
            <Text style={styles.empty}>Loading the board…</Text>
          ) : memberRows.length === 0 ? (
            <Text style={styles.empty}>No members yet.</Text>
          ) : (
            <View style={{ gap: 8, marginTop: 4 }}>
              {memberRows.map((m) => (
                <View key={m.user_id} style={styles.memberRow}>
                  <Text style={styles.memberName}>{m.display_name}</Text>
                  {m.picks.length === 0 ? (
                    <Text style={styles.noPickText}>No lock this week</Text>
                  ) : (
                    <View style={styles.lockRow}>
                      {m.picks.map((p) => (
                        <LockCard
                          key={p.id}
                          pick={p}
                          game={p.game_id ? gamesById.get(p.game_id) ?? null : null}
                          clocks={p.sport === "nfl" ? nflClocks : cfbClocks}
                        />
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed",
    borderRadius: 10, padding: 12, paddingTop: 16, gap: 4,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, flexWrap: "wrap" },
  cardTitle: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 20, color: "#B23A2E" },
  chevron: { fontSize: 12, color: "#64748B" },

  liveCountBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEE2E2",
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  liveCountText: { fontSize: 10, fontWeight: "800", color: "#991B1B", letterSpacing: 0.3 },

  collapsedSubtitle: { color: "#64748B", fontSize: 13, fontWeight: "600" },
  subheading: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  empty: { paddingVertical: 8, color: "#64748B" },

  memberRow: { gap: 6 },
  memberName: { fontWeight: "800", fontSize: 14, color: "#0C1712" },
  noPickText: { color: "#94A3B8", fontSize: 13, fontStyle: "italic" },
  lockRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  lockCard: {
    flexGrow: 1, flexBasis: 200, minWidth: 180, borderRadius: 10, borderWidth: 1.5,
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
