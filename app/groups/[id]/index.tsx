'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ViewStyle, TextStyle } from 'react-native';
import {
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase'; // ← adjust if needed

/** ---------- Types ---------- */
type MemberRow = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type PickCountRow = { user_id: string; count: number };

type PicksRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cfb_picks: number;
  nfl_picks: number;
};

type Game = {
  id: string;
  week_id: string | number;
  home_team: string;
  away_team: string;
  kickoff?: string | null;
};

/** ---------- Small UI pill ---------- */
function TeamPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[pickStyles.pill, selected ? pickStyles.pillSelected : null]}
    >
      <Text style={selected ? pickStyles.pillLabelSelected : pickStyles.pillLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

/** ---------- Inline pick board ---------- */
function PickBoard({
  groupId,
  weekId,
  onChanged,
}: {
  groupId: string;
  weekId: string | number;
  onChanged?: () => void;
}) {
  const [games, setGames] = useState<Game[]>([]);
  const [mine, setMine] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);

    // 1) games for that week (no league filter needed once week_id is known)
    const { data: gms, error: gErr } = await supabase
      .from('games')
      .select('id, week_id, home_team, away_team, kickoff')
      .eq('week_id', weekId)
      .order('kickoff', { ascending: true });

    if (gErr) {
      console.error('games error', gErr);
      setGames([]);
    } else {
      setGames(gms ?? []);
    }

    // 2) my picks on those games (for this group)
    const gameIds = (gms ?? []).map((g) => g.id);
    if (gameIds.length) {
      const { data: picks, error: pErr } = await supabase
        .from('picks')
        .select('game_id, choice')
        .eq('group_id', groupId)
        .in('game_id', gameIds);

      if (pErr) {
        console.error('picks error', pErr);
        setMine({});
      } else {
        const map: Record<string, string | null> = {};
        (picks ?? []).forEach((p) => {
          map[p.game_id] = p.choice;
        });
        setMine(map);
      }
    } else {
      setMine({});
    }

    setLoading(false);
  };

  useMemo(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, weekId]);

  const choose = async (gameId: string, choice: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      group_id: groupId,
      user_id: user.id,
      game_id: gameId,
      choice,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('picks')
      .upsert(payload, { onConflict: 'group_id,user_id,game_id' });

    if (error) {
      console.error('upsert pick error', error);
      return;
    }

    setMine((prev) => ({ ...prev, [gameId]: choice }));
    onChanged?.();
  };

  if (loading) return <Text style={styles.muted}>Loading games…</Text>;
  if (!games.length) return <Text style={styles.muted}>No games in this week.</Text>;

  return (
    <View style={pickStyles.board}>
      <FlatList
        data={games}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => {
          const choice = mine[item.id] ?? null;
          return (
            <View style={pickStyles.row}>
              <Text style={pickStyles.matchup}>
                {item.away_team} @ {item.home_team}
              </Text>
              <View style={pickStyles.pillRow}>
                <TeamPill
                  label={item.away_team}
                  selected={choice === item.away_team}
                  onPress={() => choose(item.id, item.away_team)}
                />
                <TeamPill
                  label={item.home_team}
                  selected={choice === item.home_team}
                  onPress={() => choose(item.id, item.home_team)}
                />
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

/** ---------- Page ---------- */
export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = String(id);

  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [groupName, setGroupName] = useState<string>('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [picks, setPicks] = useState<PicksRow[]>([]);
  const [nflWeekId, setNflWeekId] = useState<string | number | null>(null);
  const [cfbWeekId, setCfbWeekId] = useState<string | number | null>(null);

  /** ---- Find the latest week_id by looking at GAMES (avoids enum issues) ---- */
  async function latestWeekIdViaGames(leagueCandidates: string[]): Promise<string | number | null> {
    // Try exact matches first
    for (const val of leagueCandidates) {
      const { data, error } = await supabase
        .from('games')
        .select('week_id, kickoff')
        .eq('league', val)
        .order('kickoff', { ascending: false, nullsFirst: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].week_id != null) {
        return data[0].week_id;
      }
    }

    // Try case-insensitive contains (if your league values are messy)
    for (const val of leagueCandidates) {
      const { data, error } = await supabase
        .from('games')
        .select('week_id, kickoff')
        .ilike('league', `%${val}%`)
        .order('kickoff', { ascending: false, nullsFirst: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].week_id != null) {
        return data[0].week_id;
      }
    }

    return null;
  }

  /** ---- Pull summary counts directly (no RPC) ---- */
  async function loadSummaryCounts(wCfb: string | number | null, wNfl: string | number | null) {
    // base: all members (for names/avatars)
    const base: PicksRow[] = members.map((m) => ({
      user_id: m.user_id,
      display_name: m.display_name,
      username: m.username,
      avatar_url: m.avatar_url,
      cfb_picks: 0,
      nfl_picks: 0,
    }));

    const map = new Map<string, PicksRow>();
    base.forEach((r) => map.set(r.user_id, r));

    // helper to merge counts
    const applyCounts = (rows: PickCountRow[], target: 'cfb_picks' | 'nfl_picks') => {
      for (const r of rows) {
        const cur = map.get(r.user_id);
        if (cur) (cur as any)[target] = r.count ?? 0;
      }
    };

    // CFB counts for that week
    if (wCfb != null) {
      const { data, error } = await supabase
        .from('picks')
        .select('user_id, count:user_id', { count: 'exact', head: false }) // (we'll use an aggregate below instead)
        .limit(0); // not used, just placeholder to keep TS happy

      // real aggregate
      const { data: cfb, error: cErr } = await supabase
        .from('picks')
        .select('user_id, game_id, games!inner(week_id)')
        .eq('group_id', groupId)
        .eq('games.week_id', wCfb);

      if (cErr) {
        console.error('cfb summary error', cErr);
      } else {
        const counts: Record<string, number> = {};
        (cfb ?? []).forEach((p: any) => {
          counts[p.user_id] = (counts[p.user_id] ?? 0) + 1;
        });
        const rows: PickCountRow[] = Object.entries(counts).map(([user_id, count]) => ({
          user_id,
          count,
        }));
        applyCounts(rows, 'cfb_picks');
      }
    }

    // NFL counts for that week
    if (wNfl != null) {
      const { data: nfl, error: nErr } = await supabase
        .from('picks')
        .select('user_id, game_id, games!inner(week_id)')
        .eq('group_id', groupId)
        .eq('games.week_id', wNfl);

      if (nErr) {
        console.error('nfl summary error', nErr);
      } else {
        const counts: Record<string, number> = {};
        (nfl ?? []).forEach((p: any) => {
          counts[p.user_id] = (counts[p.user_id] ?? 0) + 1;
        });
        const rows: PickCountRow[] = Object.entries(counts).map(([user_id, count]) => ({
          user_id,
          count,
        }));
        applyCounts(rows, 'nfl_picks');
      }
    }

    setPicks(Array.from(map.values()));
  }

  /** ---- Load page ---- */
  async function load() {
    setLoading(true);
    setNotAllowed(false);

    // must be logged in
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setNotAllowed(true);
      setLoading(false);
      return;
    }

    // group access check
    const { data: grp, error: grpErr } = await supabase
      .from('groups_for_me')
      .select('id,name')
      .eq('id', groupId)
      .single();

    if (grpErr || !grp) {
      setNotAllowed(true);
      setLoading(false);
      return;
    }
    setGroupName(grp.name as string);

    // members with profile fields
    const { data: mems, error: memErr } = await supabase
      .from('group_member_profiles')
      .select('user_id, role, joined_at, display_name, username, avatar_url')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (memErr) {
      console.error('group_member_profiles error:', memErr);
      setMembers([]);
    } else {
      setMembers((mems ?? []) as MemberRow[]);
    }

    // latest weeks found from GAMES (robust to enum changes)
    const nflId = await latestWeekIdViaGames(['NFL', 'PRO', 'Pro', 'pro']);
    const cfbId = await latestWeekIdViaGames(['NCAAF', 'NCAA', 'CFB', 'College', 'college']);

    setNflWeekId(nflId);
    setCfbWeekId(cfbId);

    // summary counts (no RPC, works for uuid/bigint)
    await loadSummaryCounts(cfbId, nflId);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading group…</Text>
      </View>
    );
  }

  if (notAllowed) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>Group not available</Text>
        <Text style={styles.muted}>Make sure you’re signed in and a member/owner of this group.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>{groupName}</Text>

      {/* This Week’s Picks summary */}
      <Text style={styles.h2}>This Week’s Picks</Text>
      <View style={styles.card}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 3 }]}>User</Text>
          <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>CFB</Text>
          <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>NFL</Text>
        </View>

        {picks.length === 0 ? (
          <Text style={styles.muted}>No picks yet this week.</Text>
        ) : (
          picks.map((r) => {
            const name = r.display_name ?? r.username ?? r.user_id;
            return (
              <View key={r.user_id} style={styles.tableRow}>
                <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
                  {r.avatar_url ? (
                    <Image
                      source={{ uri: r.avatar_url }}
                      accessibilityLabel={name}
                      style={{ width: 28, height: 28, borderRadius: 999, marginRight: 8 }}
                    />
                  ) : null}
                  <Text style={styles.tdName}>{name}</Text>
                </View>
                <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{r.cfb_picks || '—'}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{r.nfl_picks || '—'}</Text>
              </View>
            );
          })
        )}

        <View style={{ marginTop: 8, flexDirection: 'row' }}>
          <Pressable onPress={load} style={styles.btn}>
            <Text>Refresh</Text>
          </Pressable>
        </View>
      </View>

      {/* Inline boards */}
      <Text style={styles.h2}>Make Your Picks</Text>
      <View style={styles.card}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>College Football</Text>
        {cfbWeekId ? (
          <PickBoard groupId={groupId} weekId={cfbWeekId} onChanged={load} />
        ) : (
          <Text style={styles.muted}>No CFB week found.</Text>
        )}

        <View style={{ height: 16 }} />

        <Text style={{ fontWeight: '700', marginBottom: 6 }}>NFL</Text>
        {nflWeekId ? (
          <PickBoard groupId={groupId} weekId={nflWeekId} onChanged={load} />
        ) : (
          <Text style={styles.muted}>No NFL week found.</Text>
        )}
      </View>

      {/* Members */}
      <Text style={styles.h2}>Members</Text>
      <FlatList
        data={members}
        keyExtractor={(m) => m.user_id}
        renderItem={({ item }) => {
          const name = item.display_name ?? item.username ?? item.user_id;
          return (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                {item.avatar_url ? (
                  <Image
                    source={{ uri: item.avatar_url }}
                    accessibilityLabel={name}
                    style={{ width: 28, height: 28, borderRadius: 999, marginRight: 8 }}
                  />
                ) : null}
                <Text style={styles.rowTitle}>{name}</Text>
              </View>
              <Text style={styles.rowSub}>
                {item.role ?? 'member'}
                {item.joined_at ? ` • joined ${new Date(item.joined_at).toLocaleDateString()}` : ''}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.muted}>No members yet.</Text>}
      />
    </View>
  );
}

/** ---------- Styles ---------- */
const styles = StyleSheet.create<{
  wrap: ViewStyle;
  h1: TextStyle;
  h2: TextStyle;
  muted: TextStyle;
  card: ViewStyle;
  tableHeader: ViewStyle;
  th: TextStyle;
  tableRow: ViewStyle;
  td: TextStyle;
  tdName: TextStyle;
  row: ViewStyle;
  rowTop: ViewStyle;
  rowTitle: TextStyle;
  rowSub: TextStyle;
  btn: ViewStyle;
}>({
  wrap: { flex: 1, padding: 16 },
  h1: { fontSize: 22, fontWeight: '600' },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  muted: { color: '#666' },

  card: { backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 16 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 6,
  },
  th: { fontWeight: '700' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  td: { color: '#222' },
  tdName: { fontWeight: '600' },

  row: { backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rowTitle: { fontWeight: '600' },
  rowSub: { color: '#666' },

  btn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f7f7f7',
  },
});

const pickStyles = StyleSheet.create({
  board: { backgroundColor: 'white', borderRadius: 12, padding: 12 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  matchup: { fontWeight: '600', marginBottom: 8 },
  pillRow: { flexDirection: 'row' },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f7f7f7',
    marginRight: 8,
  },
  pillSelected: { borderColor: '#0a7', backgroundColor: '#e6fbf4' },
  pillLabel: { color: '#222' },
  pillLabelSelected: { color: '#0a7', fontWeight: '700' },
});
