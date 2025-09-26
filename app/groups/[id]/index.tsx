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
import { supabase } from '../../../lib/supabase'; // ← adjust if your client is elsewhere

/** ------------------------------
 * Types
 * ------------------------------ */
type MemberRow = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

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
  week_id: number;
  league: 'NFL' | 'NCAAF';
  home_team: string;
  away_team: string;
  kickoff?: string | null;
};

/** ------------------------------
 * Small UI helpers for pick board
 * ------------------------------ */
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

/** ------------------------------
 * The inline PickBoard (CFB/NFL)
 * ------------------------------ */
function PickBoard({
  groupId,
  weekId,
  league,
  onChanged,
}: {
  groupId: string;
  weekId: number;
  league: 'NFL' | 'NCAAF';
  onChanged?: () => void;
}) {
  const [games, setGames] = useState<Game[]>([]);
  const [mine, setMine] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);

    // 1) games for week + league
    const { data: gms, error: gErr } = await supabase
      .from('games')
      .select('id, week_id, league, home_team, away_team, kickoff')
      .eq('week_id', weekId)
      .eq('league', league)
      .order('kickoff', { ascending: true });

    if (gErr) {
      console.error('games error', gErr);
      setGames([]);
    } else {
      setGames(gms ?? []);
    }

    // 2) user's picks for those games in this group
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
  }, [groupId, weekId, league]);

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

  if (loading) return <Text style={styles.muted}>Loading {league} games…</Text>;
  if (!games.length) return <Text style={styles.muted}>No {league} games this week.</Text>;

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

/** ------------------------------
 * Page component
 * ------------------------------ */
export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = String(id);

  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [groupName, setGroupName] = useState<string>('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [picks, setPicks] = useState<PicksRow[]>([]);
  const [nflWeekId, setNflWeekId] = useState<number | null>(null);
  const [cfbWeekId, setCfbWeekId] = useState<number | null>(null);

  // Robust "latest week" finder that works across schemas
  async function latestWeekId(league: 'NFL' | 'NCAAF'): Promise<number | null> {
    const leaguesToTry =
      league === 'NCAAF' ? ['NCAAF', 'CFB', 'College', 'COLLEGE'] : ['NFL'];

    // 1) Try time-window based (now between starts_at/ends_at)
    for (const lg of leaguesToTry) {
      const { data, error } = await supabase
        .from('weeks')
        .select('id, starts_at, ends_at')
        .eq('league', lg)
        .lte('starts_at', new Date().toISOString())
        .gt('ends_at', new Date().toISOString())
        .order('starts_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.id != null) {
        const num = typeof data.id === 'number' ? data.id : Number(data.id);
        if (!Number.isNaN(num)) return num;
        return data.id as any; // UUID fallback
      }
    }

    // 2) Fall back to most recent by week_num
    for (const lg of leaguesToTry) {
      const { data, error } = await supabase
        .from('weeks')
        .select('id, week_num')
        .eq('league', lg)
        .order('week_num', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.id != null) {
        const num = typeof data.id === 'number' ? data.id : Number(data.id);
        if (!Number.isNaN(num)) return num;
        return data.id as any;
      }
    }

    // 3) Last-resort: most recent row for the league (by id)
    for (const lg of leaguesToTry) {
      const { data, error } = await supabase
        .from('weeks')
        .select('id')
        .eq('league', lg)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.id != null) {
        const num = typeof data.id === 'number' ? data.id : Number(data.id);
        if (!Number.isNaN(num)) return num;
        return data.id as any;
      }
    }

    console.warn('latestWeekId: no week found for leagues', leaguesToTry);
    return null;
  }

  async function load() {
    setLoading(true);
    setNotAllowed(false);

    // signed in?
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setNotAllowed(true);
      setLoading(false);
      return;
    }

    // access check via groups_for_me
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

    // members (from the view with profile fields)
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

    // latest weeks for both leagues
    const [nflId, cfbId] = await Promise.all([latestWeekId('NFL'), latestWeekId('NCAAF')]);
    setNflWeekId(nflId);
    setCfbWeekId(cfbId);

    // summary counts for header (RPC expects bigint week ids)
    if (nflId != null && cfbId != null) {
      const { data: rows, error: rpcErr } = await supabase
        .rpc('group_member_picks', { g_id: groupId, w_nfl: nflId, w_cfb: cfbId });
      if (rpcErr) {
        console.error('group_member_picks error:', rpcErr);
        setPicks([]);
      } else {
        setPicks((rows ?? []) as PicksRow[]);
      }
    } else {
      setPicks([]);
    }

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
      {/* Header */}
      <Text style={styles.h1}>{groupName}</Text>

      {/* This Week’s Picks — summary */}
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

      {/* Make your picks (inline boards) */}
      <Text style={styles.h2}>Make Your Picks</Text>
      <View style={styles.card}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>College Football</Text>
        {cfbWeekId ? (
          <PickBoard groupId={groupId} weekId={cfbWeekId} league="NCAAF" onChanged={load} />
        ) : (
          <Text style={styles.muted}>No CFB week found.</Text>
        )}

        <View style={{ height: 16 }} />

        <Text style={{ fontWeight: '700', marginBottom: 6 }}>NFL</Text>
        {nflWeekId ? (
          <PickBoard groupId={groupId} weekId={nflWeekId} league="NFL" onChanged={load} />
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

/** ------------------------------
 * Styles (typed to avoid RN TS errors)
 * ------------------------------ */
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
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
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
