/* app/groups/[id]/index.tsx */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase'; // <- adjust if your path differs

type MemberRow = {
  user_id: string;
  role: string;
  joined_at: string | null;
  display_name: string | null;
};

type PickRow = {
  user_id: string;
  display_name: string;
  cfb_picks: number;
  nfl_picks: number;
};

export default function GroupDetailPage() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [loadingPicks, setLoadingPicks] = useState(false);

  // ---- FETCH: Members (LEFT join to profiles; tolerant to profiles RLS) ----
  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    setLoadingMembers(true);

    const { data, error } = await supabase
      .from('group_members')
      .select('user_id, role, joined_at, profiles:profiles(id, username)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('members query error:', error);
      setMembers([]);
      setLoadingMembers(false);
      return;
    }

    const rows = (data ?? []) as any[];
    const mapped: MemberRow[] = rows.map((r) => ({
      user_id: r.user_id,
      role: r.role,
      joined_at: r.joined_at,
      display_name: r.profiles?.username ?? r.user_id,
    }));
    setMembers(mapped);
    setLoadingMembers(false);
  }, [groupId]);

  // ---- FETCH: Per-member counts for latest CFB/NFL week ----
  const fetchPicks = useCallback(async () => {
    if (!groupId) return;
    setLoadingPicks(true);

    const { data, error } = await supabase
      .from('group_member_picks_latest')
      .select('user_id, display_name, cfb_picks, nfl_picks')
      .eq('group_id', groupId)
      .order('display_name', { ascending: true });

    if (error) {
      console.error('picks summary query error:', error);
      setPicks([]);
      setLoadingPicks(false);
      return;
    }

    const rows = (data ?? []) as any[];
    const mapped: PickRow[] = rows.map((r) => ({
      user_id: r.user_id,
      display_name: r.display_name ?? r.user_id,
      cfb_picks: Number(r.cfb_picks || 0),
      nfl_picks: Number(r.nfl_picks || 0),
    }));
    setPicks(mapped);
    setLoadingPicks(false);
  }, [groupId]);

  useEffect(() => {
    fetchMembers();
    fetchPicks();
  }, [fetchMembers, fetchPicks]);

  // ---- UI helpers ----
  const header = useMemo(
    () => (
      <View style={{ paddingVertical: 8 }}>
        <Text style={styles.h1}>This Week’s Picks</Text>
        <View style={styles.picksHeaderRow}>
          <Text style={[styles.cell, styles.cellUserHeader]}>User</Text>
          <Text style={[styles.cell, styles.cellHdr]}>CFB</Text>
          <Text style={[styles.cell, styles.cellHdr]}>NFL</Text>
        </View>
      </View>
    ),
    []
  );

  return (
    <View style={styles.page}>
      {/* Picks section */}
      <View style={styles.card}>
        {header}

        {loadingPicks ? (
          <ActivityIndicator />
        ) : picks.length ? (
          picks.map((p) => (
            <View key={p.user_id} style={styles.picksRow}>
              <Text style={[styles.cell, styles.userName]}>{p.display_name}</Text>
              <Text style={[styles.cell, styles.center]}>{p.cfb_picks}</Text>
              <Text style={[styles.cell, styles.center]}>{p.nfl_picks}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No picks yet this week.</Text>
        )}

        <View style={{ height: 16 }} />

        {/* Make your picks CTAs */}
        <Text style={styles.h2}>Make Your Picks</Text>
        <View style={{ height: 8 }} />
        <Text style={styles.h3}>College Football</Text>
        <Text style={styles.muted}>No CFB week found.</Text>
        <View style={{ height: 8 }} />
        <Text style={styles.h3}>NFL</Text>
        <Pressable
          style={styles.cta}
          onPress={() => router.push({ pathname: '/picks/page' })}
        >
          <Text style={styles.ctaText}>Go to NFL picks</Text>
        </Pressable>
      </View>

      {/* Members list */}
      <View style={styles.card}>
        <Text style={styles.h1}>Members</Text>
        {loadingMembers ? (
          <ActivityIndicator />
        ) : members.length ? (
          <FlatList
            data={members}
            keyExtractor={(m) => m.user_id}
            renderItem={({ item }) => {
              const name = item.display_name ?? item.user_id;
              return (
                <View style={styles.row}>
                  {/* no avatar column in profiles right now; keep simple */}
                  <Text style={styles.rowTitle}>{name}</Text>
                  <Text style={styles.rowSub}>
                    {item.role}{' '}
                    {item.joined_at
                      ? `• joined ${new Date(item.joined_at).toLocaleDateString()}`
                      : ''}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.muted}>No members yet.</Text>}
          />
        ) : (
          <Text style={styles.muted}>No members yet.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16 },
  card: { backgroundColor: '#eee', borderRadius: 8, padding: 12 },
  h1: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  h2: { fontSize: 16, fontWeight: '600' },
  h3: { fontSize: 14, fontWeight: '600' },
  muted: { color: '#666' },

  /* Picks table */
  picksHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    paddingBottom: 6,
    marginBottom: 6,
  },
  picksRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  cell: { flex: 1, fontSize: 14 },
  cellHdr: { textAlign: 'center', fontWeight: '600' },
  cellUserHeader: { flex: 2, fontWeight: '600' },
  userName: { flex: 2 },
  center: { textAlign: 'center' },

  /* CTAs */
  cta: {
    backgroundColor: '#083c3c',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  ctaText: { color: 'white', fontWeight: '600' },

  /* Members */
  row: { paddingVertical: 10 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#555', marginTop: 4 },
});
