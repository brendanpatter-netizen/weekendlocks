export const unstable_settings = { prerender: false };

/**
 * DIRECTION CONTRACT — "The Whiteboard" (new-work, direction seed 65ae88a4, assigned index 5)
 * THESIS: This is a locker-room whiteboard, not a dashboard — it refuses the
 *   generic dark-mode sports-app template every category default reaches for.
 * OWN-WORLD: Chalkboard-green board ground; chalk-white/marker-red/marker-blue/
 *   tape-yellow as the only ink colors; sections render as taped-up paper
 *   sheets (dashed outline, tape-corner accent, slight pinned rotation);
 *   PermanentMarker for section headers, bold system sans for data.
 * STORY: A friend opens their group and lands on the board the crew actually
 *   uses — picks, standings, and the weekly roast, hand-marked, not corporate.
 * FIRST VIEWPORT: Dark green board fills the screen; the group name is
 *   hand-lettered directly on the board in large chalk-white marker type,
 *   with a drawn padlock icon beside it — no card, no chrome, the board itself
 *   is the header.
 * FORM: Locker-room whiteboard, grounded candidate #5 of 7, ranked list:
 *   1 Trading Card Pack, 2 Stadium Scoreboard, 3 Vault/Padlock, 4 Broadcast
 *   Ticker, 5 Locker Room Whiteboard (assigned), 6 Letterman/Trophy Case,
 *   7 Game Ticket Stub. Raised with decal-style numerals (from a racing-
 *   livery challenger) and a strict fixed-palette discipline (from a
 *   teletext-broadcast challenger).
 * FINISH: unreviewed and undocumented is unfinished; this build ends with
 *   the finish review, the verdict, DESIGN.md, and every shipping raster
 *   carrying its provenance.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase";
import { refreshScoresForSport } from "@/lib/scores";
import { avatarColor, initials } from "@/lib/avatar";
import { logoUri } from "@/lib/teamLogos";
import { alert } from "@/lib/alert";
import { recordLabel, winPct, recordVibe, EMPTY_RECORD, type SeasonRecord } from "@/lib/records";
import { getOpenWeek, getNextWeek, type OpenWeek } from "@/lib/openWeek";
import { colors as theme } from "@/lib/theme";
import GroupChat from "@/components/GroupChat";
import WeeklyPicksGrid from "@/components/WeeklyPicksGrid";
import WeeklyRecap from "@/components/WeeklyRecap";
import LockIcon from "@/components/LockIcon";
import TrophyIcon from "@/components/TrophyIcon";
import TapeCorner from "@/components/TapeCorner";

// null for Over/Under totals picks (no single team) or unmapped names.
function pickLogo(team: string | null | undefined, sport: "nfl" | "ncaaf"): string | null {
  if (!team) return null;
  const uri = logoUri(team, sport);
  return uri === "about:blank" ? null : uri;
}

const NFL_LEAGUE_LOGO = "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png";
const NCAA_LEAGUE_LOGO = "https://a.espncdn.com/i/espn/misc_logos/500/ncaa.png";

// The leaderboard now shows only the combined season record — per-week
// picks moved to the WeeklyPicksGrid below it.
type MemberRow = { user_id: string; display_name: string; overall: SeasonRecord };
type ActivityItem = {
  id: string; user_id: string; display_name: string; sport: "nfl" | "cfb"; week: number;
  market: string | null; team: string | null; line: string | null; updated_at: string; was_replaced: boolean;
};

// Ranking key for the leaderboard: win% when they've got decided games,
// otherwise sinks to the bottom (haven't proven anything yet).
function rankValue(r: SeasonRecord): number {
  const decided = r.wins + r.losses;
  return decided === 0 ? -1 : r.wins / decided;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatWindow(w: OpenWeek): string {
  return `${formatDate(w.opensAt)} – ${formatDate(w.closesAt)}`;
}

// NFL runs 18 weeks, CFB 15 — one shared selector covers both; CFB just has
// no games/picks in the trailing weeks, which shows as a normal empty state.
const WEEK_COUNT = 18;

export default function GroupDashboardPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id?.[0] : id) ?? "", [id]);

  // NFL and CFB open/close on different real-world dates, so each gets its
  // own live week — undefined while resolving, null if nothing's live. When
  // nothing's live, nextWeek gives a "opens {date}" hint instead of a dead end.
  const [nflOpenWeek, setNflOpenWeek] = useState<OpenWeek | null | undefined>(undefined);
  const [cfbOpenWeek, setCfbOpenWeek] = useState<OpenWeek | null | undefined>(undefined);
  const [nflNextWeek, setNflNextWeek] = useState<OpenWeek | null>(null);
  const [cfbNextWeek, setCfbNextWeek] = useState<OpenWeek | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [nfl, cfb] = await Promise.all([getOpenWeek("nfl"), getOpenWeek("cfb")]);
      if (!mounted) return;
      setNflOpenWeek(nfl);
      setCfbOpenWeek(cfb);
      if (!nfl) getNextWeek("nfl").then((w) => { if (mounted) setNflNextWeek(w); });
      if (!cfb) getNextWeek("cfb").then((w) => { if (mounted) setCfbNextWeek(w); });
    })();
    return () => { mounted = false; };
  }, []);

  const [groupName, setGroupName] = useState("WeekendLocks");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingScores, setRefreshingScores] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Bumped on every load so WeeklyPicksGrid (which fetches its own,
  // season-wide data) knows to refetch too — including after "Refresh scores".
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const nameById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.display_name])),
    [members]
  );

  async function loadDashboard(mounted: () => boolean) {
    try {
      setLoading(true);
      setBanner(null);

      const { data: g } = await supabase
        .from("groups")
        .select("name, invite_code, owner_user_id")
        .eq("id", groupId)
        .maybeSingle();
      if (mounted() && g?.name) setGroupName(g.name);
      if (mounted()) setInviteCode(g?.invite_code ?? null);
      if (mounted()) setOwnerUserId(g?.owner_user_id ?? null);

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
          // username has the only real edit path (Account page) — prefer it.
          return [uid, p?.username || p?.display_name || uid];
        })
      );

      const { data: recordRows } = await supabase
        .from("member_records").select("user_id, sport, wins, losses")
        .eq("group_id", groupId);
      const overallByUser = new Map<string, SeasonRecord>();
      (recordRows ?? []).forEach((r: any) => {
        const cur = overallByUser.get(r.user_id) ?? { ...EMPTY_RECORD };
        cur.wins += r.wins;
        cur.losses += r.losses;
        overallByUser.set(r.user_id, cur);
      });

      const rows: MemberRow[] = rosterIds
        .map((uid) => ({
          user_id: uid,
          display_name: nameById.get(uid) ?? uid,
          overall: overallByUser.get(uid) ?? EMPTY_RECORD,
        }))
        .sort((a, b) => rankValue(b.overall) - rankValue(a.overall) || a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }));
      if (mounted()) setMembers(rows);

      // Broad recent-activity feed (not limited to the selected week) — each row is
      // labeled with sport + week so it's unambiguous.
      const { data: feedRows } = await supabase
        .from("picks_feed")
        .select("id, user_id, display_name, sport, week, market, team, line, updated_at, was_replaced")
        .eq("group_id", groupId)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (mounted()) setActivity((feedRows ?? []) as ActivityItem[]);
      if (mounted()) setDataVersion((v) => v + 1);
    } catch (e: any) {
      if (mounted()) setBanner(e?.message ?? String(e));
    } finally {
      if (mounted()) setLoading(false);
    }
  }

  useEffect(() => {
    if (!groupId) return;
    let alive = true;
    loadDashboard(() => alive);
    return () => { alive = false; };
  }, [groupId]);

  async function handleRefreshScores() {
    setRefreshingScores(true);
    try {
      const [nfl, cfb] = await Promise.all([
        refreshScoresForSport("nfl"),
        refreshScoresForSport("cfb"),
      ]);
      const err = nfl.error || cfb.error;
      if (err) setBanner(err);
      await loadDashboard(() => true);
    } finally {
      setRefreshingScores(false);
    }
  }

  const inviteLink = inviteCode ? `https://weekendlocks.com/groups/join?code=${inviteCode}` : null;

  const copyInviteCode = async () => {
    if (!inviteLink) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: groupName, text: `Join ${groupName} on WeekendLocks`, url: inviteLink });
        return;
      } catch {
        // user canceled or share failed — fall through to copy
      }
    } else if (Platform.OS !== "web") {
      try {
        await Share.share({ message: `Join ${groupName} on WeekendLocks: ${inviteLink}` });
        return;
      } catch {
        // fall through to copy
      }
    }
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOwner = !!currentUserId && !!ownerUserId && currentUserId === ownerUserId;

  function confirmDeleteGroup() {
    alert(
      `Delete "${groupName}"?`,
      "This permanently deletes the group, its members, all picks, and the chat history. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete group", style: "destructive", onPress: deleteGroup },
      ]
    );
  }

  async function deleteGroup() {
    setDeleting(true);
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    setDeleting(false);
    if (error) { alert("Could not delete group", error.message); return; }
    router.replace("/groups" as Href);
  }

  return (
    <ScrollView style={styles.pageOuter} contentContainerStyle={styles.page}>
      {/* The board itself is the header now — no separate hero card. Group
          identity previously lived in a per-group hash-colored hero block;
          under The Whiteboard, the board is one board for everyone, and
          identity moves to the hand-lettered name + member avatar chips. */}
      <View style={styles.hero}>
        <View style={styles.heroEyebrow}>
          <LockIcon size={13} color="#F5F3E7" />
          <Text style={styles.heroEyebrowText}>THE BOARD</Text>
        </View>
        <Text style={styles.heroTitle}>{groupName}</Text>
        <Text style={styles.heroSubtitle}>{members.length} member{members.length === 1 ? "" : "s"} on the crew</Text>

        <View style={styles.pickCtaRow}>
          <Pressable
            style={[styles.pickCtaBtn, !nflOpenWeek && styles.pickCtaBtnDisabled]}
            disabled={!nflOpenWeek}
            onPress={() => router.push({ pathname: "/picks/page", params: { group: groupId } } as Href)}
            accessibilityRole="button"
            accessibilityLabel={nflOpenWeek ? `Make NFL picks, week ${nflOpenWeek.week} is live` : "NFL picks, not live yet"}
          >
            <View style={[styles.pickCtaIcon, { backgroundColor: "#E1F5EE" }]}>
              <Image source={{ uri: NFL_LEAGUE_LOGO }} style={[styles.pickCtaLogo, !nflOpenWeek && styles.pickCtaLogoDisabled]} resizeMode="contain" />
            </View>
            <Text style={[styles.pickCtaTitle, !nflOpenWeek && styles.pickCtaTitleDisabled]}>NFL</Text>
            <Text style={styles.pickCtaSub}>
              {nflOpenWeek ? `Week ${nflOpenWeek.week} now live` : nflOpenWeek === null ? "Not live yet" : "Loading…"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.pickCtaBtn, !cfbOpenWeek && styles.pickCtaBtnDisabled]}
            disabled={!cfbOpenWeek}
            onPress={() => router.push({ pathname: "/picks/college", params: { group: groupId } } as Href)}
            accessibilityRole="button"
            accessibilityLabel={cfbOpenWeek ? `Make CFB picks, week ${cfbOpenWeek.week} is live` : "CFB picks, not live yet"}
          >
            <View style={[styles.pickCtaIcon, { backgroundColor: "#E6F1FB" }]}>
              <Image source={{ uri: NCAA_LEAGUE_LOGO }} style={[styles.pickCtaLogo, !cfbOpenWeek && styles.pickCtaLogoDisabled]} resizeMode="contain" />
            </View>
            <Text style={[styles.pickCtaTitle, !cfbOpenWeek && styles.pickCtaTitleDisabled]}>CFB</Text>
            <Text style={styles.pickCtaSub}>
              {cfbOpenWeek ? `Week ${cfbOpenWeek.week} now live` : cfbOpenWeek === null ? "Not live yet" : "Loading…"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.heroScheduleRow}>
          <View style={styles.heroScheduleItem}>
            <Image source={{ uri: NFL_LEAGUE_LOGO }} style={styles.heroScheduleLogo} resizeMode="contain" />
            <Text style={styles.heroScheduleText} numberOfLines={1}>
              {nflOpenWeek
                ? `Wk ${nflOpenWeek.week} · ${formatWindow(nflOpenWeek)}`
                : nflNextWeek
                ? `Opens ${formatDate(nflNextWeek.opensAt)}`
                : nflOpenWeek === null ? "Not live" : "Checking…"}
            </Text>
          </View>
          <View style={styles.heroScheduleDivider} />
          <View style={styles.heroScheduleItem}>
            <Image source={{ uri: NCAA_LEAGUE_LOGO }} style={styles.heroScheduleLogo} resizeMode="contain" />
            <Text style={styles.heroScheduleText} numberOfLines={1}>
              {cfbOpenWeek
                ? `Wk ${cfbOpenWeek.week} · ${formatWindow(cfbOpenWeek)}`
                : cfbNextWeek
                ? `Opens ${formatDate(cfbNextWeek.opensAt)}`
                : cfbOpenWeek === null ? "Not live" : "Checking…"}
            </Text>
          </View>
        </View>
      </View>

      {inviteCode && (
        <View style={styles.inviteRow}>
          <Text style={styles.inviteLabel}>Invite link</Text>
          <Text style={styles.inviteCode} numberOfLines={1}>{inviteCode}</Text>
          <Pressable
            onPress={copyInviteCode}
            style={styles.copyBtn}
            accessibilityRole="button"
            accessibilityLabel="Share group invite link"
          >
            <Text style={styles.copyBtnText}>{copied ? "Copied" : "Share"}</Text>
          </Pressable>
        </View>
      )}

      {banner && (<View style={styles.banner}><Text style={styles.bannerText}>Heads up: {banner}</Text></View>)}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        <>
        <View style={[styles.card, styles.cardElevated]}>
            <TapeCorner />
            <View style={styles.leaderboardHeader}>
              <View style={styles.cardTitleRow}>
                <TrophyIcon size={18} color="#B23A2E" />
                <Text style={styles.cardTitle}>The Standings</Text>
              </View>
              <Pressable
                onPress={handleRefreshScores}
                disabled={refreshingScores}
                style={styles.refreshBtn}
                accessibilityRole="button"
                accessibilityLabel="Refresh scores"
              >
                <Text style={styles.refreshBtnText}>{refreshingScores ? "Checking…" : "Refresh scores"}</Text>
              </Pressable>
            </View>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.thRank}>#</Text>
              <Text style={styles.thUser}>Member</Text>
              <Text style={styles.thOverall}>Record</Text>
            </View>
            {members.length === 0 ? (
              <Text style={styles.empty}>No members yet.</Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(m) => m.user_id}
                scrollEnabled={false}
                renderItem={({ item, index }) => {
                  const overallRec = recordLabel(item.overall);
                  const overallPct = winPct(item.overall);
                  const vibe = recordVibe(item.overall);
                  return (
                    <View style={styles.tableRow}>
                      <Text style={styles.rankText}>{index + 1}</Text>
                      <View style={styles.userCell}>
                        <Text style={styles.userName} numberOfLines={1}>{item.display_name}</Text>
                        {vibe && <Text style={styles.vibeChip}>{vibe}</Text>}
                      </View>
                      <View style={styles.overallCell}>
                        <Text style={styles.overallRecord}>{overallRec ?? "—"}</Text>
                        {overallPct && <Text style={styles.overallPct}>{overallPct}</Text>}
                      </View>
                    </View>
                  );
                }}
              />
            )}
            <Text style={styles.note}>Records update when you tap "Refresh scores" above — pushes count as a win.</Text>
          </View>

          <WeeklyRecap
            groupId={groupId}
            members={members.map((m) => ({ user_id: m.user_id, display_name: m.display_name }))}
            refreshKey={dataVersion}
          />

          <WeeklyPicksGrid
            groupId={groupId}
            members={members.map((m) => ({ user_id: m.user_id, display_name: m.display_name }))}
            weekCount={WEEK_COUNT}
            refreshKey={dataVersion}
          />

          <View style={styles.card}>
            <TapeCorner side="right" />
            <Text style={styles.cardTitle}>Recent activity</Text>
            {activity.length === 0 ? (
              <Text style={styles.empty}>No recent activity.</Text>
            ) : (
              <FlatList
                data={activity}
                keyExtractor={(a) => a.id}
                style={styles.activityList}
                nestedScrollEnabled
                renderItem={({ item }) => {
                  const color = avatarColor(item.user_id);
                  const logo = pickLogo(item.team, item.sport === "nfl" ? "nfl" : "ncaaf");
                  return (
                    <View style={styles.feedRow}>
                      <View style={[styles.avatarSm, { backgroundColor: color.bg }]}>
                        <Text style={[styles.avatarTextSm, { color: color.fg }]}>{initials(item.display_name)}</Text>
                      </View>
                      {!!logo && <Image source={{ uri: logo }} style={styles.feedLogo} />}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.feedTitle}>
                          <Text style={{ fontWeight: "700" }}>{item.display_name}</Text>
                          {" "}{item.was_replaced ? "swapped in" : "locked in"} {item.team ?? "a pick"}
                          {item.line ? ` ${item.line}` : ""}
                        </Text>
                        <Text style={styles.feedSub}>
                          {item.sport.toUpperCase()} • Week {item.week}
                          {item.market ? ` • ${item.market}` : ""}
                        </Text>
                        <Text style={styles.feedTime}>{new Date(item.updated_at).toLocaleString()}</Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>

          <GroupChat groupId={groupId} nameById={nameById} currentUserId={currentUserId} />

          {isOwner && (
            <View style={styles.dangerZone}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dangerTitle}>Danger zone</Text>
                <Text style={styles.dangerBody}>Deleting this group removes it for every member, permanently.</Text>
              </View>
              <Pressable
                onPress={confirmDeleteGroup}
                disabled={deleting}
                style={styles.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel={`Delete group "${groupName}", permanently`}
              >
                <Text style={styles.deleteBtnText}>{deleting ? "Deleting…" : "Delete group"}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The board itself: chalkboard-green ground, everything else pins to it.
  pageOuter: { flex: 1, backgroundColor: theme.felt },
  page: { padding: 16, gap: 16 },

  // No card/background here anymore — the name is lettered directly on the
  // board, so the hero IS the board's opening line, not a chip on top of it.
  hero: { paddingTop: 8, paddingBottom: 4, gap: 6, alignItems: "center" },
  heroEyebrow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "center", borderWidth: 1.5, borderColor: "rgba(245,243,231,0.4)", borderStyle: "dashed",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 4,
  },
  heroEyebrowText: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#F5F3E7" },
  heroTitle: {
    fontFamily: "PermanentMarker_400Regular", fontSize: 40, color: "#F5F3E7",
    letterSpacing: 0.5, textAlign: "center", textTransform: "uppercase", lineHeight: 46,
  },
  heroSubtitle: { fontSize: 13, color: "rgba(245,243,231,0.7)", marginBottom: 18, textAlign: "center", fontWeight: "700" },

  inviteRow: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F5F3E7",
    borderWidth: 1.5, borderColor: "#B4901F", borderStyle: "dashed", borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  inviteLabel: { fontSize: 12, color: "#45564C", fontWeight: "700" },
  inviteCode: { fontSize: 14, fontWeight: "800", color: "#0C1712", letterSpacing: 1 },
  copyBtn: { marginLeft: "auto", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: theme.brand },
  copyBtnText: { color: "white", fontWeight: "700", fontSize: 12 },

  banner: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderWidth: 1, borderRadius: 8, padding: 10 },
  bannerText: { color: "#9A3412" },

  pickCtaRow: { flexDirection: "row", gap: 14, flexWrap: "wrap", alignSelf: "stretch" },
  pickCtaBtn: {
    flex: 1, minWidth: 130, alignItems: "center", gap: 6, backgroundColor: "#F5F3E7",
    borderRadius: 16, paddingVertical: 18, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: "rgba(12,23,18,0.15)", borderStyle: "dashed",
    shadowColor: "#000", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28, shadowRadius: 12, elevation: 6,
  },
  // Flat + muted instead of opacity: opacity on a solid card blends it with
  // whatever's behind (the board), turning chalk-paper into a muddy gray-green.
  pickCtaBtnDisabled: { backgroundColor: "#D8D4C4", shadowOpacity: 0, elevation: 0 },
  pickCtaIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  pickCtaLogo: { width: 30, height: 30 },
  pickCtaLogoDisabled: { opacity: 0.5 },
  pickCtaTitle: { fontSize: 17, fontWeight: "800", color: "#0C1712" },
  pickCtaTitleDisabled: { color: "#94A3B8" },
  pickCtaSub: { fontSize: 12, color: "#45564C", fontWeight: "600" },

  heroScheduleRow: {
    flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: "rgba(245,243,231,0.2)", alignSelf: "stretch",
  },
  heroScheduleItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  heroScheduleDivider: { width: 1, height: 20, backgroundColor: "rgba(245,243,231,0.2)", marginHorizontal: 12 },
  heroScheduleLogo: { width: 18, height: 18 },
  heroScheduleText: { fontSize: 12, fontWeight: "600", color: "rgba(245,243,231,0.85)", flexShrink: 1 },

  // Chalk-paper sheets pinned to the board — dashed hand-drawn outline
  // instead of a hairline. Square, not tilted: a full-width card reading as
  // crooked looks broken rather than charming: the tape corner alone carries
  // the pinned-paper feel.
  card: {
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed",
    borderRadius: 10, padding: 12, paddingTop: 16, gap: 4,
  },
  // Standings + Power Rankings are the two surfaces DESIGN.md calls out for
  // more depth — everything else on the page (Recent Activity, chat) stays flat.
  cardElevated: {
    shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontFamily: "PermanentMarker_400Regular", fontSize: 20, color: "#B23A2E" },

  leaderboardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  refreshBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: theme.brand },
  refreshBtnText: { color: theme.brand, fontWeight: "700", fontSize: 12 },

  tableHeader: { paddingVertical: 6 },
  tableRow: {
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  thRank: { width: 22, fontWeight: "800", fontSize: 12, color: "#64748B" },
  thUser: { flex: 1.6, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase" },
  thOverall: { width: 72, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase", textAlign: "right" },

  rankText: { width: 22, fontWeight: "800", fontSize: 13, color: "#64748B" }, // was #94A3B8 (2.56:1) — failed WCAG AA
  userCell: { flex: 1.6, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  userName: { fontWeight: "700", flexShrink: 1 },
  vibeChip: { fontSize: 11, fontWeight: "700", color: "#64748B", marginLeft: 2 },

  overallCell: { width: 72, alignItems: "flex-end" },
  overallRecord: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  overallPct: { fontSize: 11, color: "#64748B" },

  note: { marginTop: 8, color: "#64748B", fontSize: 12 }, // was #94A3B8 (2.56:1) — failed WCAG AA
  empty: { paddingVertical: 8, color: "#64748B" },
  activityList: { maxHeight: 380 },

  feedRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB", flexDirection: "row", gap: 10 },
  avatarSm: { width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 1 },
  avatarTextSm: { fontSize: 10, fontWeight: "700" },
  feedLogo: { width: 18, height: 18, resizeMode: "contain", marginTop: 2 },
  feedTitle: { fontSize: 13, color: "#0F172A" },
  feedSub: { color: "#334155", fontSize: 12, marginTop: 2 },
  feedTime: { color: "#64748B", fontSize: 11, marginTop: 2 }, // was #94A3B8 (2.56:1) — failed WCAG AA

  dangerZone: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FEF2F2",
    borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, padding: 14,
  },
  dangerTitle: { fontWeight: "800", color: "#991B1B", fontSize: 13 },
  dangerBody: { color: "#B91C1C", fontSize: 12, marginTop: 2 },
  deleteBtn: { backgroundColor: "#DC2626", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  deleteBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
});
