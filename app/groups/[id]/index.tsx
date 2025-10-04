// app/groups/[id]/index.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../lib/supabase';

/* ------------------------------------------
 * Types
 * ----------------------------------------*/
type MemberRow = {
  user_id: string;
  role: string;
  joined_at: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url?: string | null;
};

type PickSummaryRow = {
  user_id: string;
  cfb_picks: number;
  nfl_picks: number;
};

type CombinedRow = MemberRow & {
  cfb_picks: number;
  nfl_picks: number;
};

/* ------------------------------------------
 * Component
 * ----------------------------------------*/
export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = useMemo(() => (Array.isArray(id) ? id[0] : id) ?? '', [id]);

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [picks, setPicks] = useState<PickSummaryRow[]>([]);
  const [groupName, setGroupName] = useState<string>('');

  // Load group name (optional)
  useEffect(() => {
    if (!groupId) return;
    (async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .maybeSingle();
      if (!error && data?.name) setGroupName(data.name);
    })();
  }, [groupId]);

  // Load members (prefer view, fallback to join)
  useEffect(() => {
    if (!groupId) return;
    setLoadingMembers(true);

    (async () => {
      const tryView = await supabase
        .from('group_member_profiles')
        .select('user_id, role, joined_at, display_name, username, avatar_url')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      if (!tryView.error && tryView.data) {
        setMembers(tryView.data as MemberRow[]);
        setLoadingMembers(false);
        return;
      }

      const fallback = await supabase
        .from('group_members')
        .select(
          `
          user_id,
          role,
          joined_at,
          profiles:profiles ( username, id )
        `
        )
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      if (fallback.error || !fallback.data) {
        setMembers([]);
        setLoadingMembers(false);
        return;
      }

      const mapped: MemberRow[] = fallback.data.map((r: any) => ({
        user_id: r.user_id,
        role: r.role,
        joined_at: r.joined_at,
        display_name: r.profiles?.username ?? r.user_id,
        username: r.profiles?.username ?? null,
        avatar_url: null,
      }));

      setMembers(mapped);
      setLoadingMembers(false);
    })();
  }, [groupId]);

  // Load this-week pick counts (prefer view, fallback zeros)
  useEffect(() => {
    if (!groupId) return;

    (async () => {
      const view = await supabase
        .from('group_member_picks_latest')
        .select('user_id, cfb_picks, nfl_picks')
        .eq('group_id', groupId);

      if (!view.error && view.data) {
        setPicks(view.data as PickSummaryRow[]);
        return;
      }

      if (members.length) {
        setPicks(
          members.map((m) => ({
            user_id: m.user_id,
            cfb_picks: 0,
            nfl_picks: 0,
          }))
        );
      } else {
        setPicks([]);
      }
    })();
  }, [groupId, members.length]);

  const combined: CombinedRow[] = useMemo(() => {
    if (!members.length) return [];
    const byUser = new Map<string, PickSummaryRow>();
    picks.forEach((p) => byUser.set(p.user_id, p));
    return members.map((m) => {
      const p = byUser.get(m.user_id);
      return {
        ...m,
        cfb_picks: p?.cfb_picks ?? 0,
        nfl_picks: p?.nfl_picks ?? 0,
      };
    });
  }, [members, picks]);

  const HeaderRow = () => (
    <View style={[styles.row, styles.headerRow]}>
      <Text style={[styles.cellUser, styles.headerText]}>User</Text>
      <Text style={[styles.cell, styles.headerText, { textAlign: 'center' }]}>
        CFB
      </Text>
      <Text style={[styles.cell, styles.headerText, { textAlign: 'center' }]}>
        NFL
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{groupName || 'Group'}</Text>

      {/* This Week's Picks */}
      <View style={styles.card}>
        <Text style={styles.h2}>This Week’s Picks</Text>
        <HeaderRow />
        {loadingMembers ? (
          <View style={styles.centerRow}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={combined}
            keyExtractor={(m) => m.user_id}
            renderItem={({ item }) => {
              const name =
                item.display_name ?? item.username ?? item.user_id ?? '—';
              return (
                <View style={styles.row}>
                  <View style={styles.cellUser}>
                    <View style={styles.userCell}>
                      {!!item.avatar_url && (
                        <Image
                          source={{ uri: item.avatar_url }}
                          style={styles.avatar}
                        />
                      )}
                      <Text>{name}</Text>
                    </View>
                  </View>
                  <Text style={[styles.cell, styles.centerText]}>
                    {item.cfb_picks ?? 0}
                  </Text>
                  <Text style={[styles.cell, styles.centerText]}>
                    {item.nfl_picks ?? 0}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.centerRow}>
                <Text style={styles.muted}>No picks yet this week.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Make Your Picks */}
      <View style={styles.card}>
        <Text style={styles.h2}>Make Your Picks</Text>

        <Text style={styles.h3}>College Football</Text>
        <Pressable
          style={styles.cta}
          onPress={() =>
            router.push({ pathname: '/picks/college', params: { group: groupId } }) // ← pass group
          }
        >
          <Text style={styles.ctaText}>Go to CFB picks</Text>
        </Pressable>

        <Text style={[styles.h3, { marginTop: 18 }]}>NFL</Text>
        <Pressable
          style={styles.cta}
          onPress={() =>
            router.push({ pathname: '/picks/page', params: { group: groupId } }) // ← pass group
          }
        >
          <Text style={styles.ctaText}>Go to NFL picks</Text>
        </Pressable>
      </View>

      {/* Members list */}
      <View style={styles.card}>
        <Text style={styles.h2}>Members</Text>
        {loadingMembers ? (
          <ActivityIndicator />
        ) : members.length ? (
          <FlatList
            data={members}
            keyExtractor={(m) => m.user_id}
            renderItem={({ item }) => {
              const name =
                item.display_name ?? item.username ?? item.user_id ?? '—';
              return (
                <View style={styles.memberRow}>
                  <Text style={styles.memberName}>{name}</Text>
                  <Text style={styles.memberSub}>
                    {item.role ?? 'member'}
                    {item.joined_at
                      ? ` • joined ${new Date(item.joined_at).toLocaleDateString()}`
                      : ''}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.muted}>No members yet.</Text>
            }
          />
        ) : (
          <Text style={styles.muted}>No members yet.</Text>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------
 * Styles
 * ----------------------------------------*/
const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  h2: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  h3: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  muted: { color: '#6b7280' },
  card: { backgroundColor: '#e5e7eb33', borderRadius: 8, padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d5db',
  },
  headerRow: { borderTopWidth: 0, paddingTop: 0, paddingBottom: 8 },
  headerText: { fontWeight: '700' },
  cellUser: { flex: 1.5 },
  cell: { flex: 0.5 },
  centerRow: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  userCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 999, marginRight: 8 },
  cta: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#0b735f', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  ctaText: { color: 'white', fontWeight: '700' },
  memberRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d1d5db' },
  memberName: { fontWeight: '700' },
  memberSub: { color: '#6b7280', marginTop: 2 },
});
