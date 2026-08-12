export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase";
import { getCurrentWeek as getCurrentNFLWeek } from "@/lib/nflWeeks";
import { getCurrentCfbWeek as getCurrentCFBWeek } from "@/lib/cfbWeeks";
import { refreshScoresForSport } from "@/lib/scores";
import { avatarColor, initials } from "@/lib/avatar";
import { pickLabel } from "@/lib/pickLabel";
import { logoUri } from "@/lib/teamLogos";
import { alert } from "@/lib/alert";
import GroupChat from "@/components/GroupChat";
import WeekPills from "@/components/WeekPills";

// null for Over/Under totals picks (no single team) or unmapped names.
function pickLogo(team: string | null | undefined, sport: "nfl" | "ncaaf"): string | null {
  if (!team) return null;
  const uri = logoUri(team, sport);
  return uri === "about:blank" ? null : uri;
}

type PickInfo = { market: string | null; team: string | null; line: string | null; price: number | null };
// A push counts as a win (house rule) — member_records already folds it in,
// so there's no separate push count to track or display here.
type SeasonRecord = { wins: number; losses: number };
type MemberRow = {
  user_id: string; display_name: string; nfl: PickInfo | null; cfb: PickInfo | null;
  nflRecord: SeasonRecord; cfbRecord: SeasonRecord;
};
type ActivityItem = {
  id: string; user_id: string; display_name: string; sport: "nfl" | "cfb"; week: number;
  market: string | null; team: string | null; line: string | null; updated_at: string; was_replaced: boolean;
};

const EMPTY_RECORD: SeasonRecord = { wins: 0, losses: 0 };

function recordLabel(r: SeasonRecord): string | null {
  if (r.wins === 0 && r.losses === 0) return null;
  return `${r.wins}-${r.losses}`;
}
function winPct(r: SeasonRecord): string | null {
  const decided = r.wins + r.losses;
  if (decided === 0) return null;
  return `${Math.round((100 * r.wins) / decided)}%`;
}

// NFL runs 18 weeks, CFB 15 — one shared selector covers both; CFB just has
// no games/picks in the trailing weeks, which shows as a normal empty state.
const WEEK_COUNT = 18;

export default function GroupDashboardPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id?.[0] : id) ?? "", [id]);

  // A single shared week drives both sports — whichever league has
  // progressed further in real time (they can open on different dates).
  const currentWeek = useMemo(
    () => Math.max(getCurrentNFLWeek(), getCurrentCFBWeek()),
    []
  );
  const [week, setWeek] = useState(currentWeek);

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

      const [{ data: nflRows }, { data: cfbRows }, { data: recordRows }] = await Promise.all([
        supabase.from("picks").select("user_id, market, team, line, price")
          .eq("group_id", groupId).eq("sport", "nfl").eq("week", week),
        supabase.from("picks").select("user_id, market, team, line, price")
          .eq("group_id", groupId).eq("sport", "cfb").eq("week", week),
        supabase.from("member_records").select("user_id, sport, wins, losses")
          .eq("group_id", groupId),
      ]);
      const nflByUser = new Map((nflRows ?? []).map((r: any) => [r.user_id, r as PickInfo]));
      const cfbByUser = new Map((cfbRows ?? []).map((r: any) => [r.user_id, r as PickInfo]));
      const nflRecordByUser = new Map<string, SeasonRecord>();
      const cfbRecordByUser = new Map<string, SeasonRecord>();
      (recordRows ?? []).forEach((r: any) => {
        const rec: SeasonRecord = { wins: r.wins, losses: r.losses };
        (r.sport === "nfl" ? nflRecordByUser : cfbRecordByUser).set(r.user_id, rec);
      });

      const rows: MemberRow[] = rosterIds
        .map((uid) => ({
          user_id: uid,
          display_name: nameById.get(uid) ?? uid,
          nfl: nflByUser.get(uid) ?? null,
          cfb: cfbByUser.get(uid) ?? null,
          nflRecord: nflRecordByUser.get(uid) ?? EMPTY_RECORD,
          cfbRecord: cfbRecordByUser.get(uid) ?? EMPTY_RECORD,
        }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }));
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
  }, [groupId, week]);

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
            style={styles.pickCtaBtn}
            onPress={() => router.push({ pathname: "/picks/page", params: { group: groupId, w: String(week) } } as Href)}
          >
            <View style={[styles.pickCtaIcon, { backgroundColor: "#E1F5EE", transform: [{ rotate: "-6deg" }] }]}>
              <Ionicons name="american-football" size={24} color="#085041" />
            </View>
            <Text style={styles.pickCtaTitle}>NFL</Text>
            <Text style={styles.pickCtaSub}>Week {week}</Text>
          </Pressable>
          <Pressable
            style={styles.pickCtaBtn}
            onPress={() => router.push({ pathname: "/picks/college", params: { group: groupId, w: String(week) } } as Href)}
          >
            <View style={[styles.pickCtaIcon, { backgroundColor: "#E6F1FB", transform: [{ rotate: "6deg" }] }]}>
              <Ionicons name="school" size={24} color="#0C447C" />
            </View>
            <Text style={styles.pickCtaTitle}>CFB</Text>
            <Text style={styles.pickCtaSub}>Week {week}</Text>
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

      <View style={styles.weekSelectorCol}>
        <View style={styles.weekLabelRow}>
          <Text style={styles.weekLabel}>Week</Text>
          {week !== currentWeek && (
            <Pressable onPress={() => setWeek(currentWeek)}>
              <Text style={styles.jumpToCurrent}>Back to current</Text>
            </Pressable>
          )}
        </View>
        <WeekPills count={WEEK_COUNT} selected={week} current={currentWeek} onSelect={setWeek} />
      </View>

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
              <Text style={styles.thUser}>Member</Text>
              <Text style={styles.thPick}>NFL wk {week}</Text>
              <Text style={styles.thPick}>CFB wk {week}</Text>
              <Text style={styles.thOverall}>Overall</Text>
            </View>
            {members.length === 0 ? (
              <Text style={styles.empty}>No members yet.</Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(m) => m.user_id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const color = avatarColor(item.user_id);
                  const nfl = pickLabel(item.nfl);
                  const cfb = pickLabel(item.cfb);
                  const nflRec = recordLabel(item.nflRecord);
                  const cfbRec = recordLabel(item.cfbRecord);
                  const overall: SeasonRecord = {
                    wins: item.nflRecord.wins + item.cfbRecord.wins,
                    losses: item.nflRecord.losses + item.cfbRecord.losses,
                  };
                  const overallRec = recordLabel(overall);
                  const overallPct = winPct(overall);
                  return (
                    <View style={styles.tableRow}>
                      <View style={styles.userCell}>
                        <View style={[styles.avatar, { backgroundColor: color.bg }]}>
                          <Text style={[styles.avatarText, { color: color.fg }]}>{initials(item.display_name)}</Text>
                        </View>
                        <Text style={styles.userName} numberOfLines={1}>{item.display_name}</Text>
                      </View>
                      <View style={styles.pickCell}>
                        {nfl ? (
                          <View style={[styles.badge, styles.badgeNfl]}>
                            {!!pickLogo(item.nfl?.team, "nfl") && <Image source={{ uri: pickLogo(item.nfl?.team, "nfl")! }} style={styles.badgeLogo} />}
                            <Text style={[styles.badgeText, styles.badgeTextNfl]}>{nfl}</Text>
                          </View>
                        ) : (
                          <Text style={styles.noPick}>No pick yet</Text>
                        )}
                        {nflRec && <Text style={styles.recordSub}>{nflRec}</Text>}
                      </View>
                      <View style={styles.pickCell}>
                        {cfb ? (
                          <View style={[styles.badge, styles.badgeCfb]}>
                            {!!pickLogo(item.cfb?.team, "ncaaf") && <Image source={{ uri: pickLogo(item.cfb?.team, "ncaaf")! }} style={styles.badgeLogo} />}
                            <Text style={[styles.badgeText, styles.badgeTextCfb]}>{cfb}</Text>
                          </View>
                        ) : (
                          <Text style={styles.noPick}>No pick yet</Text>
                        )}
                        {cfbRec && <Text style={styles.recordSub}>{cfbRec}</Text>}
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
  pickCtaIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  pickCtaTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  pickCtaSub: { fontSize: 12, color: "#64748B", fontWeight: "600" },

  weekSelectorCol: { gap: 6 },
  weekLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  weekLabel: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  jumpToCurrent: { fontSize: 12, color: "#0B735F", fontWeight: "700" },

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
  thUser: { flex: 1.6, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase" },
  thPick: { flex: 1, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase" },
  thOverall: { width: 64, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase", textAlign: "right" },

  userCell: { flex: 1.6, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  avatar: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700" },
  userName: { fontWeight: "700", flexShrink: 1 },

  pickCell: { flex: 1, gap: 2 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 5 },
  badgeNfl: { backgroundColor: "#E1F5EE" },
  badgeCfb: { backgroundColor: "#E6F1FB" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeLogo: { width: 14, height: 14, resizeMode: "contain" },
  badgeTextNfl: { color: "#085041" },
  badgeTextCfb: { color: "#0C447C" },
  noPick: { fontSize: 13, color: "#94A3B8" },
  recordSub: { fontSize: 11, color: "#94A3B8", marginLeft: 2 },

  overallCell: { width: 64, alignItems: "flex-end" },
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
