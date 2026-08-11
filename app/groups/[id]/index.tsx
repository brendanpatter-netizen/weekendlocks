export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase";
import { getCurrentWeek as getCurrentNFLWeek } from "@/lib/nflWeeks";
import { getCurrentCfbWeek as getCurrentCFBWeek } from "@/lib/cfbWeeks";

type PickInfo = { market: string | null; team: string | null; line: string | null; price: number | null };
type MemberRow = { user_id: string; display_name: string; nfl: PickInfo | null; cfb: PickInfo | null };
type ActivityItem = {
  id: string; user_id: string; display_name: string; sport: "nfl" | "cfb"; week: number;
  market: string | null; team: string | null; line: string | null; updated_at: string; was_replaced: boolean;
};

// NFL runs 18 weeks, CFB 15 — one shared selector covers both; CFB just has
// no games/picks in the trailing weeks, which shows as a normal empty state.
const WEEK_COUNT = 18;

// Deterministic avatar color per member so the same person always gets the
// same color across the app, without storing anything.
const AVATAR_COLORS = [
  { bg: "#E1F5EE", fg: "#085041" },
  { bg: "#FAECE7", fg: "#712B13" },
  { bg: "#EEEDFE", fg: "#3C3489" },
  { bg: "#E6F1FB", fg: "#0C447C" },
  { bg: "#FBEAF0", fg: "#72243E" },
  { bg: "#FAEEDA", fg: "#633806" },
];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function avatarColor(id: string) {
  return AVATAR_COLORS[hashStr(id) % AVATAR_COLORS.length];
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function pickLabel(p: PickInfo | null): string | null {
  if (!p) return null;
  const line = p.line ? ` ${p.line}` : "";
  return `${p.team ?? "?"}${line}`;
}

function WeekPills({
  count, selected, current, onSelect,
}: { count: number; selected: number; current: number; onSelect: (w: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {Array.from({ length: count }, (_, i) => i + 1).map((w) => {
        const active = w === selected;
        return (
          <Pressable
            key={w}
            onPress={() => onSelect(w)}
            style={[styles.weekPill, active && styles.weekPillActive]}
          >
            <Text style={[styles.weekPillText, active && styles.weekPillTextActive]}>{w}</Text>
            {w === current && <View style={[styles.liveDot, active && styles.liveDotActive]} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

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
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setBanner(null);

        const { data: g } = await supabase
          .from("groups")
          .select("name, invite_code")
          .eq("id", groupId)
          .maybeSingle();
        if (mounted && g?.name) setGroupName(g.name);
        if (mounted) setInviteCode(g?.invite_code ?? null);

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

        const [{ data: nflRows }, { data: cfbRows }] = await Promise.all([
          supabase.from("picks").select("user_id, market, team, line, price")
            .eq("group_id", groupId).eq("sport", "nfl").eq("week", week),
          supabase.from("picks").select("user_id, market, team, line, price")
            .eq("group_id", groupId).eq("sport", "cfb").eq("week", week),
        ]);
        const nflByUser = new Map((nflRows ?? []).map((r: any) => [r.user_id, r as PickInfo]));
        const cfbByUser = new Map((cfbRows ?? []).map((r: any) => [r.user_id, r as PickInfo]));

        const rows: MemberRow[] = rosterIds
          .map((uid) => ({
            user_id: uid,
            display_name: nameById.get(uid) ?? uid,
            nfl: nflByUser.get(uid) ?? null,
            cfb: cfbByUser.get(uid) ?? null,
          }))
          .sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }));
        if (mounted) setMembers(rows);

        // Broad recent-activity feed (not limited to the selected week) — each row is
        // labeled with sport + week so it's unambiguous.
        const { data: feedRows } = await supabase
          .from("picks_feed")
          .select("id, user_id, display_name, sport, week, market, team, line, updated_at, was_replaced")
          .eq("group_id", groupId)
          .order("updated_at", { ascending: false })
          .limit(20);
        if (mounted) setActivity((feedRows ?? []) as ActivityItem[]);
      } catch (e: any) {
        if (mounted) setBanner(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [groupId, week]);

  const copyInviteCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.page}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{groupName}</Text>
          <Text style={styles.subtitle}>{members.length} member{members.length === 1 ? "" : "s"}</Text>
        </View>
        <View style={styles.ctaRow}>
          <Pressable
            style={styles.cta}
            onPress={() => router.push({ pathname: "/picks/page", params: { group: groupId, w: String(week) } } as Href)}
          >
            <Text style={styles.ctaText}>Make NFL pick</Text>
          </Pressable>
          <Pressable
            style={styles.ctaSecondary}
            onPress={() => router.push({ pathname: "/picks/college", params: { group: groupId, w: String(week) } } as Href)}
          >
            <Text style={styles.ctaSecondaryText}>Make CFB pick</Text>
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
          <View style={styles.card}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.thUser}>Member</Text>
              <Text style={styles.thPick}>NFL wk {week}</Text>
              <Text style={styles.thPick}>CFB wk {week}</Text>
            </View>
            {members.length === 0 ? (
              <Text style={styles.empty}>No members yet.</Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(m) => m.user_id}
                renderItem={({ item }) => {
                  const color = avatarColor(item.user_id);
                  const nfl = pickLabel(item.nfl);
                  const cfb = pickLabel(item.cfb);
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
                          <View style={[styles.badge, styles.badgeNfl]}><Text style={[styles.badgeText, styles.badgeTextNfl]}>{nfl}</Text></View>
                        ) : (
                          <Text style={styles.noPick}>No pick yet</Text>
                        )}
                      </View>
                      <View style={styles.pickCell}>
                        {cfb ? (
                          <View style={[styles.badge, styles.badgeCfb]}><Text style={[styles.badgeText, styles.badgeTextCfb]}>{cfb}</Text></View>
                        ) : (
                          <Text style={styles.noPick}>No pick yet</Text>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            )}
            <Text style={styles.note}>Season records &amp; win % coming soon.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent activity</Text>
            {activity.length === 0 ? (
              <Text style={styles.empty}>No recent activity.</Text>
            ) : (
              <FlatList
                data={activity}
                keyExtractor={(a) => a.id}
                renderItem={({ item }) => {
                  const color = avatarColor(item.user_id);
                  return (
                    <View style={styles.feedRow}>
                      <View style={[styles.avatarSm, { backgroundColor: color.bg }]}>
                        <Text style={[styles.avatarTextSm, { color: color.fg }]}>{initials(item.display_name)}</Text>
                      </View>
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#64748B", fontSize: 13, marginTop: 2 },

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

  ctaRow: { flexDirection: "row", gap: 8 },
  cta: { backgroundColor: "#0B735F", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  ctaText: { color: "white", fontWeight: "700", fontSize: 13 },
  ctaSecondary: { borderWidth: 1, borderColor: "#0B735F", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  ctaSecondaryText: { color: "#0B735F", fontWeight: "700", fontSize: 13 },

  weekSelectorCol: { gap: 6 },
  weekLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  weekLabel: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  jumpToCurrent: { fontSize: 12, color: "#0B735F", fontWeight: "700" },

  weekPill: {
    minWidth: 34, height: 34, paddingHorizontal: 10, borderRadius: 999,
    borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4,
  },
  weekPillActive: { backgroundColor: "#0B735F", borderColor: "#0B735F" },
  weekPillText: { fontSize: 13, fontWeight: "700", color: "#334155" },
  weekPillTextActive: { color: "white" },
  liveDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: "#0B735F" },
  liveDotActive: { backgroundColor: "white" },

  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 4 },
  cardTitle: { fontWeight: "800", marginBottom: 8 },

  tableHeader: { paddingVertical: 6 },
  tableRow: {
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  thUser: { flex: 1.6, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase" },
  thPick: { flex: 1, fontWeight: "800", fontSize: 12, color: "#64748B", textTransform: "uppercase" },

  userCell: { flex: 1.6, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  avatar: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700" },
  userName: { fontWeight: "700", flexShrink: 1 },

  pickCell: { flex: 1 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeNfl: { backgroundColor: "#E1F5EE" },
  badgeCfb: { backgroundColor: "#E6F1FB" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextNfl: { color: "#085041" },
  badgeTextCfb: { color: "#0C447C" },
  noPick: { fontSize: 13, color: "#94A3B8" },

  note: { marginTop: 8, color: "#94A3B8", fontSize: 12 },
  empty: { paddingVertical: 8, color: "#64748B" },

  feedRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB", flexDirection: "row", gap: 10 },
  avatarSm: { width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 1 },
  avatarTextSm: { fontSize: 10, fontWeight: "700" },
  feedTitle: { fontSize: 13, color: "#0F172A" },
  feedSub: { color: "#334155", fontSize: 12, marginTop: 2 },
  feedTime: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
});
