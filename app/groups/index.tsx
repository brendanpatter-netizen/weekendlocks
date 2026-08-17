'use client';
export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { avatarColor, initials } from "@/lib/avatar";
import { alert } from "@/lib/alert";
import { colors as theme } from "@/lib/theme";
import { getOpenWeek } from "@/lib/openWeek";
import { recordLabel, winPct, EMPTY_RECORD, type SeasonRecord } from "@/lib/records";
import { logoUri } from "@/lib/teamLogos";
import TapeCorner from "@/components/TapeCorner";
import TrophyIcon from "@/components/TrophyIcon";

type Group = {
  id: string;
  name: string;
  invite_code: string | null;
  owner_user_id: string;
  created_at: string;
};

type GroupPreview = {
  members: { id: string; name: string }[];
  memberCount: number;
  leader: { name: string; record: SeasonRecord; logo: string | null } | null;
  needsPick: boolean;
};

// picks_feed.logoUri returns 'about:blank' when a name doesn't map to a
// known team — same helper as the group dashboard's Recent Activity uses.
function pickLogo(team: string | null | undefined, sport: string): string | null {
  if (!team) return null;
  const uri = logoUri(team, sport === "nfl" ? "nfl" : "ncaaf");
  return uri === "about:blank" ? null : uri;
}

export default function GroupsIndex() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [previews, setPreviews] = useState<Map<string, GroupPreview>>(new Map());
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...groups].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
      ),
    [groups]
  );

  async function load() {
    setLoading(true);

    // Ensure we’re signed in; RLS will hide everything if not
    const { data: { session }, error: authErr } = await supabase.auth.getSession();
    if (authErr) {
      alert("Auth error", authErr.message);
      setLoading(false);
      return;
    }
    if (!session) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setCurrentUserId(session.user.id);

    // Single, simple query: groups I own OR am a member of
    const { data, error } = await supabase
      .from("groups_for_me")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Load error", error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as Group[];
    setGroups(rows);
    setLoading(false);

    // Board previews (leader/record, avatar cluster, "picks open" nudge) load
    // separately and fill in a beat later — the base list shouldn't wait on
    // N extra queries per group just to become visible.
    void loadPreviews(rows, session.user.id);
  }

  async function loadPreviews(groupList: Group[], userId: string) {
    const [nflWeek, cfbWeek] = await Promise.all([getOpenWeek("nfl"), getOpenWeek("cfb")]);
    // Same "no NFL yet, CFB already open" gap-week rule as the picks pages —
    // two CFB locks required instead of one CFB + one NFL.
    const isGapWeek = !!cfbWeek && !nflWeek;

    const entries = await Promise.all(
      groupList.map(async (g): Promise<readonly [string, GroupPreview]> => {
        const [{ data: gm }, { data: recordRows }] = await Promise.all([
          supabase.from("group_members").select("user_id").eq("group_id", g.id),
          supabase.from("member_records").select("user_id, wins, losses").eq("group_id", g.id),
        ]);
        const rosterIds = (gm ?? []).map((r: any) => r.user_id as string);

        const { data: profs } = rosterIds.length
          ? await supabase.from("profiles").select("id, username, display_name").in("id", rosterIds)
          : { data: [] as any[] };
        const nameById = new Map<string, string>(
          rosterIds.map((uid) => {
            const p = (profs ?? []).find((x: any) => x.id === uid);
            return [uid, p?.username || p?.display_name || uid];
          })
        );

        const recByUser = new Map<string, SeasonRecord>();
        (recordRows ?? []).forEach((r: any) => {
          const cur = recByUser.get(r.user_id) ?? { ...EMPTY_RECORD };
          cur.wins += r.wins;
          cur.losses += r.losses;
          recByUser.set(r.user_id, cur);
        });

        // Same ranking rule as the Standings: win% among decided games,
        // 0 decided sinks to the bottom, ties broken by name.
        let leaderUid: string | null = null;
        let leaderName: string | null = null;
        let leaderRecord: SeasonRecord = EMPTY_RECORD;
        let bestVal = -Infinity;
        rosterIds.forEach((uid) => {
          const rec = recByUser.get(uid) ?? EMPTY_RECORD;
          const decided = rec.wins + rec.losses;
          const val = decided === 0 ? -1 : rec.wins / decided;
          const name = nameById.get(uid) ?? uid;
          if (leaderName === null || val > bestVal || (val === bestVal && name.localeCompare(leaderName, undefined, { sensitivity: "base" }) < 0)) {
            bestVal = val;
            leaderUid = uid;
            leaderName = name;
            leaderRecord = rec;
          }
        });

        // A small flourish, not a data point: the leader's most recent lock,
        // shown as its team logo. Only worth fetching once they've actually
        // got a decided record — skip the extra query otherwise.
        let leaderLogo: string | null = null;
        if (leaderUid && leaderRecord.wins + leaderRecord.losses > 0) {
          const { data: lastPick } = await supabase
            .from("picks_feed")
            .select("team, sport")
            .eq("group_id", g.id)
            .eq("user_id", leaderUid)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          leaderLogo = lastPick ? pickLogo(lastPick.team, lastPick.sport) : null;
        }

        let needsPick = false;
        if (rosterIds.includes(userId) && (nflWeek || cfbWeek)) {
          const { data: myPicks } = await supabase
            .from("picks")
            .select("sport, week, slot")
            .eq("group_id", g.id)
            .eq("user_id", userId);
          const has = (sport: string, week: number, slot: number) =>
            (myPicks ?? []).some((p: any) => p.sport === sport && p.week === week && p.slot === slot);
          if (isGapWeek && cfbWeek) {
            needsPick = !has("cfb", cfbWeek.week, 1) || !has("cfb", cfbWeek.week, 2);
          } else {
            const needsNfl = !!nflWeek && !has("nfl", nflWeek.week, 1);
            const needsCfb = !!cfbWeek && !has("cfb", cfbWeek.week, 1);
            needsPick = needsNfl || needsCfb;
          }
        }

        return [
          g.id,
          {
            members: rosterIds.slice(0, 4).map((uid) => ({ id: uid, name: nameById.get(uid) ?? uid })),
            memberCount: rosterIds.length,
            leader: leaderName ? { name: leaderName, record: leaderRecord, logo: leaderLogo } : null,
            needsPick,
          },
        ] as const;
      })
    );

    setPreviews(new Map(entries));
  }

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      await load();

      // Realtime: if my memberships or owned groups change, reload list
      ch = supabase
        .channel("groups-index")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "group_members",
            filter: user ? `user_id=eq.${user.id}` : undefined,
          },
          () => { void load(); }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "groups",
            filter: user ? `owner_user_id=eq.${user.id}` : undefined,
          },
          () => { void load(); }
        )
        .subscribe();
    })();

    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  // CREATE via RPC (also inserts owner as a member)
  const createGroup = async () => {
    const name = createName.trim();
    if (!name) return alert("Missing name", "Give your group a name.");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert("Sign in required");

    const { data: newId, error } = await supabase.rpc("create_group", { p_name: name });
    if (error || !newId) {
      return alert("Create failed", error?.message || "No id returned");
    }

    setCreateName("");
    router.push({ pathname: "/groups/[id]", params: { id: String(newId) } });
  };

  // JOIN via RPC (idempotent)
  const joinByCode = async () => {
    const code = joinCode.trim();
    if (!code) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert("Sign in required");

    const { data: gId, error } = await supabase.rpc("join_group_via_code", { p_code: code });
    if (error || !gId) {
      return alert("Not found", "No group found for that invite code.");
    }

    setJoinCode("");
    router.push({ pathname: "/groups/[id]", params: { id: String(gId) } });
  };

  if (loading) {
    return (
      <View style={[styles.outer, { alignItems: "center", justifyContent: "center", gap: 8 }]}>
        <ActivityIndicator color="#F5F3E7" />
        <Text style={styles.muted}>Loading groups…</Text>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        data={sorted}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={
          <>
            <Text style={styles.h1}>Your groups</Text>
            <Text style={styles.muted}>Create a group or join one with a code.</Text>

            <View style={styles.actionsRow}>
              <View style={styles.card}>
                <TapeCorner />
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: "#E1F5EE" }]}>
                    <Ionicons name="add-circle-outline" size={20} color="#085041" />
                  </View>
                  <Text style={styles.h2}>Create a group</Text>
                </View>
                <TextInput
                  value={createName}
                  onChangeText={setCreateName}
                  placeholder="Group name"
                  placeholderTextColor="#8B876F"
                  style={styles.input}
                />
                <Pressable onPress={createGroup} style={styles.button}>
                  <Text style={styles.buttonText}>Create</Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <TapeCorner side="right" />
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: "#E6F1FB" }]}>
                    <Ionicons name="key-outline" size={20} color="#0C447C" />
                  </View>
                  <Text style={styles.h2}>Join with code</Text>
                </View>
                <TextInput
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="e.g. a1b2c3"
                  placeholderTextColor="#8B876F"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Pressable onPress={joinByCode} style={styles.buttonSecondary}>
                  <Text style={styles.buttonSecondaryText}>Join</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ marginTop: 20 }} />
          </>
        }
        renderItem={({ item }) => {
          const color = avatarColor(item.id);
          const isOwner = item.owner_user_id === currentUserId;
          const preview = previews.get(item.id);
          const leaderLabel = preview?.leader ? recordLabel(preview.leader.record) : null;
          const overflow = preview ? preview.memberCount - preview.members.length : 0;
          return (
            <Link href={{ pathname: "/groups/[id]", params: { id: item.id } }} asChild>
              <Pressable style={styles.row}>
                {preview?.needsPick && (
                  <View style={styles.nudgeBadge}>
                    <Text style={styles.nudgeBadgeText}>Picks open</Text>
                  </View>
                )}
                <View style={styles.rowTop}>
                  <View style={[styles.rowBadge, { backgroundColor: color.bg }]}>
                    <Text style={[styles.rowBadgeText, { color: color.fg }]}>{initials(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.rowTitleLine}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                      {isOwner && (
                        <View style={styles.ownerTag}><Text style={styles.ownerTagText}>Owner</Text></View>
                      )}
                    </View>
                    <Text style={styles.rowSub}>
                      Created {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </View>

                {preview && preview.members.length > 0 && (
                  <View style={styles.rowPreview}>
                    <View style={styles.cluster}>
                      {preview.members.map((m, i) => {
                        const c = avatarColor(m.id);
                        return (
                          <View
                            key={m.id}
                            style={[styles.clusterAvatar, { backgroundColor: c.bg, marginLeft: i === 0 ? 0 : -8 }]}
                          >
                            <Text style={[styles.clusterAvatarText, { color: c.fg }]}>{initials(m.name)}</Text>
                          </View>
                        );
                      })}
                      {overflow > 0 && (
                        <View style={[styles.clusterAvatar, styles.clusterOverflow, { marginLeft: -8 }]}>
                          <Text style={styles.clusterOverflowText}>+{overflow}</Text>
                        </View>
                      )}
                    </View>
                    {preview.leader && leaderLabel ? (
                      <View style={styles.leaderLine}>
                        <TrophyIcon size={13} color="#B23A2E" />
                        <Text style={styles.leaderName} numberOfLines={1}>{preview.leader.name}</Text>
                        <Text style={styles.leaderRecord}>
                          {leaderLabel}{winPct(preview.leader.record) ? ` · ${winPct(preview.leader.record)}` : ""}
                        </Text>
                        {!!preview.leader.logo && (
                          <View style={styles.leaderLogoWrap}>
                            <Image source={{ uri: preview.leader.logo }} style={styles.leaderLogo} resizeMode="contain" />
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.leaderRecord}>No picks yet this season</Text>
                    )}
                  </View>
                )}
              </Pressable>
            </Link>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={28} color="rgba(245,243,231,0.4)" />
            <Text style={styles.muted}>You’re not in any groups yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: theme.felt },
  container: { padding: 16, gap: 4 },
  h1: { fontFamily: "PermanentMarker_400Regular", fontSize: 26, color: "#F5F3E7" },
  h2: { fontFamily: "PermanentMarker_400Regular", fontSize: 16, color: "#B23A2E" },
  muted: { color: "rgba(245,243,231,0.7)", fontWeight: "700" },

  actionsRow: { flexDirection: "row", gap: 14, marginTop: 16, flexWrap: "wrap" },
  // Single-instance cards (not a repeated list) — dashed border + tape,
  // square rather than tilted so a full-width card never reads as crooked.
  card: {
    position: "relative",
    flex: 1,
    minWidth: 220,
    backgroundColor: "#F5F3E7",
    padding: 16,
    paddingTop: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(12,23,18,0.18)",
    borderStyle: "dashed",
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  input: {
    backgroundColor: "#FDFCF8",
    borderWidth: 1,
    borderColor: "rgba(12,23,18,0.18)",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: "#0C1712",
  },
  button: {
    backgroundColor: theme.brand,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  buttonText: { color: "white", fontWeight: "700" },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: theme.brand,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  buttonSecondaryText: { color: theme.brand, fontWeight: "700" },

  // Repeated list items — chalk-paper + dashed border for board continuity,
  // but flat and square (List Restraint Rule), like the picks pages' game cards.
  // Column now (was a single row): the top line is unchanged, a second
  // "board preview" line (avatar cluster + leader) sits below it.
  row: {
    position: "relative",
    backgroundColor: "#F5F3E7",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(12,23,18,0.18)",
    padding: 14,
    marginBottom: 10,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowBadgeText: { fontSize: 14, fontWeight: "700" },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { fontWeight: "700", fontSize: 16, color: "#0C1712", flexShrink: 1 },
  rowSub: { color: "#45564C", marginTop: 2, fontSize: 12 },
  ownerTag: { backgroundColor: "#FAEEDA", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  ownerTagText: { fontSize: 10, fontWeight: "700", color: "#633806" },

  // Board preview: member avatar cluster + the current standings leader —
  // reason to glance at the list itself, not just a router to click through.
  rowPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(12,23,18,0.12)",
  },
  cluster: { flexDirection: "row", alignItems: "center" },
  clusterAvatar: {
    width: 24, height: 24, borderRadius: 999, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#F5F3E7",
  },
  clusterAvatarText: { fontSize: 10, fontWeight: "700" },
  clusterOverflow: { backgroundColor: "#E9ECE8" },
  clusterOverflowText: { fontSize: 9, fontWeight: "700", color: "#45564C" },
  // flex:1 (not just flexShrink) so it fills the row's remaining width after
  // the avatar cluster — that's what lets the trailing logo's marginLeft:
  // "auto" push it flush to the row's right edge instead of just its own.
  leaderLine: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  leaderName: { fontSize: 13, fontWeight: "700", color: "#0C1712", flexShrink: 1 },
  leaderRecord: { fontSize: 12, color: "#45564C", fontWeight: "600" },
  // White backing behind the logo — team logos assume a light background,
  // same treatment as the league logos in the group hero's pick CTAs.
  leaderLogoWrap: {
    width: 20, height: 20, borderRadius: 999, backgroundColor: "white",
    alignItems: "center", justifyContent: "center", padding: 2, marginLeft: "auto",
  },
  leaderLogo: { width: "100%", height: "100%" },

  // Square, no rotation — same as everything else in the product (see The
  // Accent-Only Tilt Rule). Only unusual thing about it is the absolute
  // position, overlapping the row's top edge like a corner flag. Marker-red
  // + dashed keeps it in the existing "hand-marked" ink family instead of
  // inventing a new alert color.
  nudgeBadge: {
    position: "absolute", top: -9, right: 14, backgroundColor: "#F5F3E7",
    borderWidth: 1.5, borderColor: "#B23A2E", borderStyle: "dashed", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  nudgeBadgeText: { fontSize: 10, fontWeight: "800", color: "#B23A2E", letterSpacing: 0.3, textTransform: "uppercase" },

  emptyState: { alignItems: "center", gap: 8, paddingVertical: 32 },
});
