'use client';

import { useEffect, useState } from 'react';
import type { ViewStyle, TextStyle } from 'react-native';
import { Text, View, ActivityIndicator, StyleSheet, FlatList, Image, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase'; // ← change if your client lives elsewhere

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

export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = String(id);

  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [groupName, setGroupName] = useState<string>('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [picks, setPicks] = useState<PicksRow[]>([]);

  // Get latest week id for a league (DB has bigint id -> number in JS result)
  async function latestWeekId(league: 'NFL' | 'NCAAF'): Promise<number | null> {
    const { data, error } = await supabase
      .from('weeks')
      .select('id, week_num')
      .eq('league', league)
      .order('week_num', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('weeks error', league, error);
      return null;
    }
    return (data?.id as unknown as number) ?? null;
  }

  async function load() {
    setLoading(true);
    setNotAllowed(false);
    setPicks([]);
    setMembers([]);

    // must be signed in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setNotAllowed(true);
      setLoading(false);
      return;
    }

    // access check: only members/owners see the group
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

    // members (with display fields) via view
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

    // weekly picks summary (uses bigint week ids)
    const [nflId, cfbId] = await Promise.all([latestWeekId('NFL'), latestWeekId('NCAAF')]);
    if (nflId != null && cfbId != null) {
      const { data: rows, error: rpcErr } = await supabase
        .rpc('group_member_picks', { g_id: groupId, w_nfl: nflId, w_cfb: cfbId });
      if (rpcErr) {
        console.error('group_member_picks error:', rpcErr);
        setPicks([]);
      } else {
        setPicks((rows ?? []) as PicksRow[]);
      }
    }

    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [groupId]);

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

      {/* This Week’s Picks */}
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
