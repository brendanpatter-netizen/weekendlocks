export const unstable_settings = { prerender: false };

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import { useOdds } from "@/lib/useOdds";
import { supabase } from "@/lib/supabase";
import { norm, matchupsLikelyMatch } from "@/lib/teamMatch";
import { pickLabel } from "@/lib/pickLabel";
import { alert } from "@/lib/alert";
import { getOpenWeek, type OpenWeek } from "@/lib/openWeek";
import { displayWeek } from "@/lib/weekLabel";
import { logoUri } from "@/lib/teamLogos";
import { colors as theme } from "@/lib/theme";
import LockIcon from "@/components/LockIcon";
import TapeCorner from "@/components/TapeCorner";

// lib/teamLogos.logoUri returns 'about:blank' when a name doesn't map to a
// known team (e.g. "Over"/"Under" outcomes) — treat that as "no logo".
function getTeamLogo(name?: string | null): string | null {
  if (!name) return null;
  const uri = logoUri(name, "ncaaf");
  return uri === "about:blank" ? null : uri;
}

type MarketKey = "spreads" | "totals" | "h2h";
type CurrentPick = { market: string; team: string | null; line: string | null };

/* helpers */
function computeSide(game: any, outcome: any, market: MarketKey)
  : "home" | "away" | "over" | "under" | "team" {
  const on = norm(outcome?.name ?? "");
  if (market === "totals") {
    if (on.startsWith("over")) return "over";
    if (on.startsWith("under")) return "under";
    return "team";
  }
  const home = norm(game.home_team ?? game.home ?? "");
  const away = norm(game.away_team ?? game.away ?? "");
  if (on.includes(home)) return "home";
  if (on.includes(away)) return "away";
  return "team";
}

/* resolve/create game id (same as NFL, league='cfb') */
async function resolveOrCreateGameId(opts: {
  league: "nfl" | "cfb"; week: number; home: string; away: string; commenceIso: string; externalId?: string | null;
}) {
  const center = new Date(opts.commenceIso).getTime();
  const windowMs = 48 * 60 * 60 * 1000;
  const fromIso = new Date(center - windowMs).toISOString();
  const toIso = new Date(center + windowMs).toISOString();

  const { data: rows } = await supabase
    .from("games")
    .select("id, home, away, kickoff_at")
    .gte("kickoff_at", fromIso)
    .lte("kickoff_at", toIso);

  if (rows?.length) {
    for (const r of rows) {
      if (matchupsLikelyMatch(r.home, r.away, opts.home, opts.away, opts.league)) return r.id;
    }
  }

  const { data, error } = await supabase.rpc("upsert_game_from_feed", {
    _league: opts.league, _week: opts.week, _kickoff_at: opts.commenceIso,
    _home: opts.home, _away: opts.away, _external_id: opts.externalId ?? null,
  });

  if (error) return null;
  return data as number | null;
}

type GroupPick = { user_id: string; display_name: string; market: string; team: string | null; line: string | null; slot: number };

export default function CFBPicksPage() {
  const params = useLocalSearchParams<{ group?: string }>();
  const groupId = useMemo(
    () => (Array.isArray(params.group) ? params.group[0] : params.group) ?? null,
    [params.group]
  );

  const [tab, setTab] = useState<MarketKey>("spreads");
  // undefined = still resolving, null = resolved but no CFB week is live right now.
  const [openWeek, setOpenWeek] = useState<OpenWeek | null | undefined>(undefined);
  // Only used to detect the CFB-before-NFL-opens gap weeks (CFB live, NFL not).
  const [nflOpenWeek, setNflOpenWeek] = useState<OpenWeek | null | undefined>(undefined);
  useEffect(() => {
    let mounted = true;
    getOpenWeek("cfb").then((w) => { if (mounted) setOpenWeek(w); });
    getOpenWeek("nfl").then((w) => { if (mounted) setNflOpenWeek(w); });
    return () => { mounted = false; };
  }, []);
  const week = openWeek?.week ?? 0;
  // CFB runs ~2 weekends before the NFL season opens — during that gap,
  // members pick two CFB locks instead of one CFB + one NFL, so the
  // "2 picks a week" rhythm holds all season instead of dropping to 1.
  const isGapWeek = !!openWeek && nflOpenWeek === null;

  const [activeSlot, setActiveSlot] = useState<1 | 2>(1);
  useEffect(() => { setActiveSlot(1); }, [week]);

  const { data: games, loading, error } = useOdds("americanfootball_ncaaf", week, {
    markets: ["spreads", "totals", "h2h"],
    region: "us",
    oddsFormat: "american",
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [myPicks, setMyPicks] = useState<Map<number, CurrentPick>>(new Map());
  const [groupPicks, setGroupPicks] = useState<GroupPick[]>([]);
  const [saved, setSaved] = useState(false);

  const currentPick = myPicks.get(activeSlot) ?? null;
  // outcome key ("market|team|line") -> who holds it. Your own OTHER slot's
  // pick shows up here too (labeled distinctly) — you can't use the same
  // outcome for both locks any more than two different members could.
  const takenBy = useMemo(() => {
    const taken = new Map<string, string>();
    groupPicks.forEach((p) => {
      if (p.user_id === userId && p.slot === activeSlot) return; // this is the slot you're viewing — that's "picked", not "taken"
      const label = p.user_id === userId ? `Your Lock #${p.slot}` : p.display_name;
      taken.set(`${p.market}|${p.team}|${p.line}`, label);
    });
    return taken;
  }, [groupPicks, userId, activeSlot]);

  // Load whatever picks already exist for this group + week (both slots, so
  // the tab switch above is instant), plus every other group member's
  // current picks, so outcomes they've already locked in can be shown as taken.
  async function loadPickState(uid: string) {
    const [{ data: mine }, { data: feed }] = await Promise.all([
      supabase.from("picks").select("slot, market, team, line")
        .eq("user_id", uid).eq("group_id", groupId).eq("sport", "cfb").eq("week", week),
      supabase.from("picks_feed").select("user_id, display_name, market, team, line, slot")
        .eq("group_id", groupId).eq("sport", "cfb").eq("week", week),
    ]);
    const bySlot = new Map<number, CurrentPick>();
    (mine ?? []).forEach((r: any) => bySlot.set(r.slot, r));
    setMyPicks(bySlot);
    setGroupPicks((feed ?? []) as GroupPick[]);
  }

  useEffect(() => {
    if (!groupId || !week) { setMyPicks(new Map()); setGroupPicks([]); return; }
    let mounted = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;
      if (!mounted) return;
      setUserId(user.id);
      await loadPickState(user.id);
    })();
    return () => { mounted = false; };
  }, [groupId, week]);

  // Replace picks (no duplicate-key error) using the unique index (group_id,user_id,sport,week).
  // Every pick belongs to a group — picks.group_id is NOT NULL in the DB.
  async function handlePick(game: any, outcome: any, market: MarketKey) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { router.push("/auth/login" as Href); return; }
    if (!groupId) { alert("No group selected", "Open this page from a group to make picks."); return; }
    if (!week) { alert("No live week", "There's no CFB week open for picks right now."); return; }

    const gameId = await resolveOrCreateGameId({
      league: "cfb", week,
      home: game.home_team ?? game.home ?? "",
      away: game.away_team ?? game.away ?? "",
      commenceIso: game.commence_time,
      externalId: game.id ?? null,
    });
    if (!gameId) { alert("Could not save pick", "Could not resolve/create matchup in the DB."); return; }

    const team = outcome?.name ?? null;
    const line = typeof outcome?.point === "number" ? String(outcome.point) : null;

    // created_at is intentionally omitted: on INSERT the column default (now())
    // applies, and on the ON CONFLICT DO UPDATE it's left untouched, so
    // replacing a pick preserves the original created_at.
    const row = {
      user_id: user.id,
      group_id: groupId,
      sport: "cfb" as const,
      week,
      slot: activeSlot,
      game_id: gameId,
      market,
      team,
      price: typeof outcome?.price === "number" ? outcome.price : null,
      line,
      side: computeSide(game, outcome, market),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from("picks")
      .upsert(row, { onConflict: "group_id,user_id,sport,week,slot", ignoreDuplicates: false });

    if (upsertErr) {
      if (upsertErr.code === "23505" && upsertErr.message?.includes("picks_unique_outcome_per_group")) {
        alert("Already taken", "Another member of your group (or your other lock) already has that pick — choose a different one.");
        await loadPickState(user.id);
        return;
      }
      alert("Could not save pick", upsertErr.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    await loadPickState(user.id);
  }

  async function handleClear() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user; if (!user) return;
    if (!groupId) return;

    const { error: delErr } = await supabase.from("picks").delete()
      .eq("user_id", user.id)
      .eq("group_id", groupId)
      .eq("sport", "cfb")
      .eq("week", week)
      .eq("slot", activeSlot);
    if (delErr) { alert("Could not clear pick", delErr.message); return; }
    await loadPickState(user.id);
  }

  return (
    <ScrollView style={styles.pageOuter} contentContainerStyle={styles.page}>
      <View style={styles.pageHeader}>
        <View style={styles.pageTitleRow}>
          <LockIcon size={22} color="#F5F3E7" />
          <Text style={styles.pageTitle}>
            This Weekend's CFB Locks{openWeek ? ` — Week ${displayWeek(openWeek.week)}` : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: "/picks/page", params: { group: groupId ?? undefined } } as Href)}
          style={styles.crossLinkChip}
        >
          <Text style={styles.crossLinkText}>Go to NFL ↗</Text>
        </Pressable>
      </View>

      {!groupId && (
        <View style={{ backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderWidth: 1, borderRadius: 8, padding: 10 }}>
          <Text style={{ color: "#9A3412" }}>Open this page from a group to make picks.</Text>
        </View>
      )}

      {isGapWeek && (
        <View style={styles.gapNotice}>
          <Text style={styles.gapNoticeText}>
            NFL hasn't opened yet — pick two CFB locks this week instead of one CFB + one NFL.
          </Text>
        </View>
      )}

      {groupId && week > 0 && isGapWeek && (
        <View style={styles.slotRow}>
          {([1, 2] as const).map((s) => (
            <Pressable key={s} onPress={() => setActiveSlot(s)}
              style={[styles.slotTab, activeSlot === s && styles.slotTabActive]}>
              <Text style={[styles.slotTabText, activeSlot === s && styles.slotTabTextActive]}>
                Lock #{s}{myPicks.get(s) ? " ✓" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {groupId && week > 0 && (
        <View style={styles.pickStatus}>
          <Text style={styles.pickStatusText}>
            {saved ? "✓ Pick saved: " : isGapWeek ? `Lock #${activeSlot}: ` : "Your pick: "}
            {pickLabel(currentPick) ?? "none yet"}
          </Text>
          {currentPick && (
            <Pressable onPress={handleClear} style={styles.clearBtn}>
              <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 13 }}>Clear my pick</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.push(`/groups/${groupId}` as Href)} style={styles.backBtn}>
            <Text style={{ color: theme.brand, fontWeight: "700", fontSize: 13 }}>Back to group</Text>
          </Pressable>
        </View>
      )}

      {openWeek === undefined ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : openWeek === null ? (
        <View style={styles.noLiveWeek}>
          <TapeCorner />
          <Text style={styles.noLiveWeekTitle}>No CFB week is live right now</Text>
          <Text style={styles.noLiveWeekBody}>Picks open once the next week's window starts — check back soon.</Text>
        </View>
      ) : (
      <>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["spreads", "totals", "h2h"] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)}
            style={[styles.tab, tab === k && styles.tabActive]}>
            <Text style={[styles.tabText, tab === k && { color: "white" }]}>{k.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={{ color: "#F5F3E7" }}>Error loading odds.</Text>
      ) : (
        (games ?? []).map((g: any) => {
          const markets = g.bookmakers?.[0]?.markets ?? [];
          const m = markets.find((x: any) => x.key === tab);
          const outcomes: any[] = m?.outcomes ?? [];
          const hLogo = getTeamLogo(g.home_team);
          const aLogo = getTeamLogo(g.away_team);
          const started = new Date(g.commence_time).getTime() <= Date.now();

          return (
            <View key={g.id} style={[styles.gameCard, started && styles.gameCardStarted]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {!!aLogo && <Image source={{ uri: aLogo }} style={styles.logo} />}
                <Text style={{ fontWeight: "800", color: "#0C1712" }}>{g.away_team} @ {g.home_team}</Text>
                {!!hLogo && <Image source={{ uri: hLogo }} style={styles.logo} />}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#45564C" }}>{new Date(g.commence_time).toLocaleString()}</Text>
                {started && <View style={styles.startedBadge}><Text style={styles.startedBadgeText}>Started</Text></View>}
              </View>

              <View style={{ gap: 8, marginTop: 8 }}>
                {outcomes.map((o, i) => {
                  // Totals outcomes are literally named "Over"/"Under" on every game, so
                  // matching by team name alone would highlight that outcome across every
                  // card at once — the line (point) disambiguates which specific game.
                  const outcomeLine = typeof o.point === "number" ? String(o.point) : null;
                  const isPicked = currentPick?.market === tab && currentPick?.team === o.name && currentPick?.line === outcomeLine;
                  const takenByName = isPicked ? undefined : takenBy.get(`${tab}|${o.name}|${outcomeLine}`);
                  const oLogo = getTeamLogo(o.name); // null for Over/Under — no team to show
                  return (
                    <Pressable
                      key={i}
                      disabled={started || !!takenByName}
                      onPress={() => handlePick(g, o, tab)}
                      style={[
                        styles.outcomeBtn,
                        isPicked && styles.outcomeBtnActive,
                        !!takenByName && styles.outcomeBtnTaken,
                        { flexDirection: "row", alignItems: "center", gap: 8 },
                      ]}
                    >
                      {!!oLogo && <Image source={{ uri: oLogo }} style={styles.outcomeLogo} />}
                      <Text style={[{ fontWeight: "700" }, isPicked && { color: "white" }, !!takenByName && styles.outcomeTextTaken]}>
                        {isPicked ? "✓ " : ""}{o.name}
                        {typeof o.point === "number" ? ` ${o.point > 0 ? "+" : ""}${o.point}` : ""}
                        {typeof o.price === "number" ? `  (${o.price})` : ""}
                      </Text>
                      {!!takenByName && <Text style={styles.takenLabel}>Taken by {takenByName}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
      </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageOuter: { flex: 1, backgroundColor: theme.felt },
  page: { padding: 16, gap: 12, paddingBottom: 24 },

  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pageTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  pageTitle: { fontFamily: "PermanentMarker_400Regular", fontSize: 26, color: "#F5F3E7", flexShrink: 1 },
  crossLinkChip: {
    borderWidth: 1.5, borderColor: "rgba(245,243,231,0.4)", borderStyle: "dashed",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  crossLinkText: { color: "#F5F3E7", fontWeight: "800", fontSize: 12, letterSpacing: 0.3 },

  tab: {
    paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1.5, borderRadius: 999,
    borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed", backgroundColor: "#F5F3E7",
  },
  tabActive: { backgroundColor: "#0B735F", borderColor: "#0B735F", borderStyle: "solid" },
  tabText: { fontWeight: "800", color: "#0C1712", fontSize: 12 },

  // Game cards stay flat, dashed-border paper (board continuity) but skip the
  // per-card rotation/tape treatment — a dense scrolling list of tilted cards
  // would fight scanability on a page that's for making picks fast.
  gameCard: { backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderRadius: 12, padding: 12, marginBottom: 10, gap: 6 },
  gameCardStarted: { opacity: 0.55 },
  startedBadge: { backgroundColor: "#F1F5F9", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  startedBadgeText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  outcomeBtn: { backgroundColor: "#0B735F22", borderWidth: 1, borderColor: "#0B735F55", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  outcomeBtnActive: { backgroundColor: "#0B735F", borderColor: "#0B735F" },
  outcomeBtnTaken: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  outcomeTextTaken: { color: "#94A3B8", textDecorationLine: "line-through" },
  takenLabel: { marginLeft: "auto", fontSize: 11, color: "#94A3B8", fontStyle: "italic" },
  clearBtn: { paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderRadius: 999, borderColor: "#DC2626", backgroundColor: "rgba(220,38,38,0.06)" },
  backBtn: { paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderRadius: 999, borderColor: theme.brand, backgroundColor: "rgba(11,115,95,0.06)" },
  logo: { width: 28, height: 28, resizeMode: "contain" },
  outcomeLogo: { width: 20, height: 20, resizeMode: "contain" },

  // Same paper/dashed-gold/tilt recipe as the group dashboard's invite row
  // and the NFL picks page's pick-status strip — the one "pinned note" per page.
  pickStatus: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F5F3E7",
    borderWidth: 1.5, borderColor: "#B4901F", borderStyle: "dashed", borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  pickStatusText: { flex: 1, fontWeight: "700", color: "#0C1712" },

  noLiveWeek: {
    position: "relative", alignItems: "center", gap: 4, backgroundColor: "#F5F3E7",
    borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed", borderRadius: 10,
    padding: 24, marginTop: 8,
  },
  noLiveWeekTitle: { fontFamily: "PermanentMarker_400Regular", fontSize: 18, color: "#B23A2E" },
  noLiveWeekBody: { color: "#45564C", fontSize: 13, textAlign: "center", fontWeight: "700" },

  // Left as its own plain info callout, same as the prior world — an alert
  // box, not a board fixture, so it stays outside the paper/tape language.
  gapNotice: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", borderWidth: 1, borderRadius: 8, padding: 10 },
  gapNoticeText: { color: "#1D4ED8", fontSize: 13 },

  slotRow: { flexDirection: "row", gap: 8 },
  slotTab: {
    flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed", backgroundColor: "#F5F3E7",
  },
  slotTabActive: { backgroundColor: "#0B735F", borderColor: "#0B735F", borderStyle: "solid" },
  slotTabText: { fontWeight: "800", color: "#0C1712", fontSize: 13 },
  slotTabTextActive: { color: "white" },
});
