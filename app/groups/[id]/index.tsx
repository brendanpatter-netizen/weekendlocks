export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase";
import { refreshScoresForSport } from "@/lib/scores";
import { avatarColor, initials } from "@/lib/avatar";
import { logoUri } from "@/lib/teamLogos";
import { alert } from "@/lib/alert";
import { recordLabel, winPct, EMPTY_RECORD, type SeasonRecord } from "@/lib/records";
import { getOpenWeek, type OpenWeek } from "@/lib/openWeek";
import GroupChat from "@/components/GroupChat";
import WeeklyPicksGrid from "@/components/WeeklyPicksGrid";

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

// NFL runs 18 weeks, CFB 15 — one shared selector covers both; CFB just has
// no games/picks in the trailing weeks, which shows as a normal empty state.
const WEEK_COUNT = 18;

export default function GroupDashboardPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id?.[0] : id) ?? "", [id]);

  // NFL and CFB open/close on different real-world dates, so each gets its
  // own live week — undefined while resolving, null if nothing's live.
  const [nflOpenWeek, setNflOpenWeek] = useState<OpenWeek | null | undefined>(undefined);
  const [cfbOpenWeek, setCfbOpenWeek] = useState<OpenWeek | null | undefined>(undefined);
  useEffect(() => {
    let mounted = true;
    getOpenWeek("nfl").then((w) => { if (mounted) setNflOpenWeek(w); });
    getOpenWeek("cfb").then((w) => { if (mounted) setCfbOpenWeek(w); });
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

  const copyInviteCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
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

  const groupColor = avatarColor(groupId);

  return (
    <ScrollView style={styles.pageOuter} contentContainerStyle={styles.page}>
      <View style={[styles.hero, { backgroundColor: groupColor.fg }]}>
        <View style={styles.heroEyebrow}>
          <Text style={styles.heroEyebrowText}>GROUP</Text>
        </View>
        <Text style={styles.heroTitle}>{groupName}</Text>
        <Text style={styles.heroSubtitle}>{members.length} member{members.length === 1 ? "" : "s"}</Text>

        <View style={styles.pickCtaRow}>
          <Pressable
            style={[styles.pickCtaBtn, !nflOpenWeek && styles.pickCtaBtnDisabled]}
            disabled={!nflOpenWeek}
            onPress={() => router.push({ pathname: "/picks/page", params: { group: groupId } } as Href)}
          >
            <View style={[styles.pickCtaIcon, { backgroundColor: "#E1F5EE", transform: [{ rotate: "-6deg" }] }]}>
              <Image source={{ uri: NFL_LEAGUE_LOGO }} style={styles.pickCtaLogo} resizeMode="contain" />
            </View>
            <Text style={styles.pickCtaTitle}>NFL</Text>
            <Text style={styles.pickCtaSub}>
              {nflOpenWeek ? `Week ${nflOpenWeek.week} now live` : nflOpenWeek === null ? "Not live yet" : "Loading…"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.pickCtaBtn, !cfbOpenWeek && styles.pickCtaBtnDisabled]}
            disabled={!cfbOpenWeek}
            onPress={() => router.push({ pathname: "/picks/college", params: { group: groupId } } as Href)}
          >
            <View style={[styles.pickCtaIcon, { backgroundColor: "#E6F1FB", transform: [{ rotate: "6deg" }] }]}>
              <Image source={{ uri: NCAA_LEAGUE_LOGO }} style={styles.pickCtaLogo} resizeMode="contain" />
            </View>
            <Text style={styles.pickCtaTitle}>CFB</Text>
            <Text style={styles.pickCtaSub}>
              {cfbOpenWeek ? `Week ${cfbOpenWeek.week} now live` : cfbOpenWeek === null ? "Not live yet" : "Loading…"}
            </Text>
          </Pressable>
        </View>
      </View>

      {inviteCode && (
        <View style={styles.inviteRow}>
          <Text style={styles.inviteLabel}>Invite code</Text>
          <Text style={styles.inviteCode}>{inviteCode}</Text>
          <Pressable onPress={copyInviteCode} style={styles.copyBtn}>
            <Text style={styles.copyBtnText}>{copied ? "Copied" : "Copy"}</Text>
          </Pressable>
        </View>
      )}

      {banner && (<View style={styles.banner}><Text style={styles.bannerText}>Heads up: {banner}</Text></View>)}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        <>
        <View style={styles.topRow}>
          <View style={[styles.card, styles.topRowCol]}>
            <View style={styles.leaderboardHeader}>
              <Text style={styles.cardTitle}>Group leaderboard</Text>
              <Pressable onPress={handleRefreshScores} disabled={refreshingScores} style={styles.refreshBtn}>
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
                  const color = avatarColor(item.user_id);
                  const overallRec = recordLabel(item.overall);
                  const overallPct = winPct(item.overall);
                  return (
                    <View style={styles.tableRow}>
                      <Text style={styles.rankText}>{index + 1}</Text>
                      <View style={styles.userCell}>
                        <View style={[styles.avatar, { backgroundColor: color.bg }]}>
                          <Text style={[styles.avatarText, { color: color.fg }]}>{initials(item.display_name)}</Text>
                        </View>
                        <Text style={styles.userName} numberOfLines={1}>{item.display_name}</Text>
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

          <View style={[styles.card, styles.topRowCol, styles.activityCard]}>
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
                          {" "}{item.was_replaced ? "replaced their" : "picked"} {item.team ?? "a pick"}
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
        </View>

          <WeeklyPicksGrid
            groupId={groupId}
            members={members.map((m) => ({ user_id: m.user_id, display_name: m.display_name }))}
            weekCount={WEEK_COUNT}
            refreshKey={dataVersion}
          />

          <GroupChat groupId={groupId} nameById={nameById} currentUserId={currentUserId} />

          {isOwner && (
            <View style={styles.dangerZone}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dangerTitle}>Danger zone</Text>
                <Text style={styles.dangerBody}>Deleting this group removes it for every member, permanently.</Text>
              </View>
              <Pressable onPress={confirmDeleteGroup} disabled={deleting} style={styles.deleteBtn}>
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
  pageOuter: { flex: 1 },
  page: { padding: 16, gap: 16 },

  hero: { borderRadius: 24, padding: 20, gap: 4 },
  heroEyebrow: {
    alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4,
  },
  heroEyebrowText: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: "white" },
  heroTitle: { fontSize: 34, fontWeight: "900", color: "white", letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 18 },

  inviteRow: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC",
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
  },
  inviteLabel: { fontSize: 12, color: "#64748B", fontWeight: "700" },
  inviteCode: { fontSize: 14, fontWeight: "800", color: "#0F172A", letterSpacing: 1 },
  copyBtn: { marginLeft: "auto", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#0B735F" },
  copyBtnText: { color: "white", fontWeight: "700", fontSize: 12 },

  banner: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderWidth: 1, borderRadius: 8, padding: 10 },
  bannerText: { color: "#9A3412" },

  pickCtaRow: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  pickCtaBtn: {
    flex: 1, minWidth: 130, alignItems: "center", gap: 6, backgroundColor: "white",
    borderRadius: 20, paddingVertical: 18, paddingHorizontal: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 4,
  },
  pickCtaBtnDisabled: { opacity: 0.5 },
  pickCtaIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  pickCtaLogo: { width: 30, height: 30 },
  pickCtaTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  pickCtaSub: { fontSize: 12, color: "#64748B", fontWeight: "600" },

  // No explicit alignItems — default "stretch" makes both columns match the
  // height of the taller one (the leaderboard, which grows as members join),
  // and the activity card's own list scrolls to fit within that height.
  topRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  topRowCol: { flex: 1, minWidth: 320 },
  activityCard: { flexShrink: 1 },

  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 4 },
  cardTitle: { fontWeight: "800" },

  leaderboardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  refreshBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: "#0B735F" },
  refreshBtnText: { color: "#0B735F", fontWeight: "700", fontSize: 12 },

  tableHeader: { paddingVertical: 6 },
  tableRow: {
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  thRank: { width: 22, fontWeight: "800", fontSize: 12, color: "#64748B" },
  thUser: { flex: 1.6, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase" },
  thOverall: { width: 72, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase", textAlign: "right" },

  rankText: { width: 22, fontWeight: "800", fontSize: 13, color: "#94A3B8" },
  userCell: { flex: 1.6, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  avatar: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700" },
  userName: { fontWeight: "700", flexShrink: 1 },

  overallCell: { width: 72, alignItems: "flex-end" },
  overallRecord: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  overallPct: { fontSize: 11, color: "#64748B" },

  note: { marginTop: 8, color: "#94A3B8", fontSize: 12 },
  empty: { paddingVertical: 8, color: "#64748B" },
  activityList: { flex: 1, maxHeight: 480 },

  feedRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB", flexDirection: "row", gap: 10 },
  avatarSm: { width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 1 },
  avatarTextSm: { fontSize: 10, fontWeight: "700" },
  feedLogo: { width: 18, height: 18, resizeMode: "contain", marginTop: 2 },
  feedTitle: { fontSize: 13, color: "#0F172A" },
  feedSub: { color: "#334155", fontSize: 12, marginTop: 2 },
  feedTime: { color: "#94A3B8", fontSize: 11, marginTop: 2 },

  dangerZone: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FEF2F2",
    borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, padding: 14,
  },
  dangerTitle: { fontWeight: "800", color: "#991B1B", fontSize: 13 },
  dangerBody: { color: "#B91C1C", fontSize: 12, marginTop: 2 },
  deleteBtn: { backgroundColor: "#DC2626", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  deleteBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
});
