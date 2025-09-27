// app/groups/[id]/index.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Session } from '@supabase/supabase-js';

// ⬇️ Adjust this path if your client lives somewhere else
import { supabase } from '../../../lib/supabase';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Group = {
  id: string;
  name: string;
  owner_user_id: string | null;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type PicksSummaryRow = {
  group_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  cfb_picks: number;
  nfl_picks: number;
};

type LatestWeekRow = {
  league: 'nfl' | 'cfb';
  week_id: number;
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = useMemo(() => String(id ?? ''), [id]);

  const [session, setSession] = useState<Session | null>(null);

  const [group, setGroup] = useState<Group | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [mine, setMine] = useState<PicksSummaryRow | null>(null);
  const [groupSummaries, setGroupSummaries] = useState<PicksSummaryRow[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(true);

  const [latestWeeks, setLatestWeeks] = useState<Record<'cfb' | 'nfl', number | null>>({
    cfb: null,
    nfl: null,
  });
  const [loadingWeeks, setLoadingWeeks] = useState(true);

  /* ----------------------------- Session watch ---------------------------- */

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;

  /* -------------------------------- Fetchers ------------------------------ */

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    setLoadingGroup(true);
    const { data, error } = await supabase
      .from('groups')
      .select('id,name,owner_user_id,created_at')
      .eq('id', groupId)
      .maybeSingle();
    if (!error) setGroup(data as Group);
    setLoadingGroup(false);
  }, [groupId]);

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    setLoadingMembers(true);
    // group_members + profiles.username
    const { data, error } = await supabase
      .from('group_members')
      .select('user_id,role,joined_at,profiles:profiles!inner(id,username)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (!error && data) {
      const m: MemberRow[] = (data as any[]).map((r) => ({
        user_id: r.user_id,
        role: r.role,
        joined_at: r.joined_at,
        display_name: r.profiles?.username ?? r.user_id,
        avatar_url: null, // profiles has no avatar col in your schema (we keep the key)
      }));
      setMembers(m);
    }
    setLoadingMembers(false);
  }, [groupId]);

  const fetchSummaries = useCallback(async () => {
    if (!groupId) return;
    setLoadingSummaries(true);

    // Uses the new view we built in SQL:
    // public.group_member_picks_latest
    const { data, error } = await supabase
      .from('group_member_picks_latest')
      .select('*')
      .eq('group_id', groupId);

    if (!error && data) {
      const rows = data as PicksSummaryRow[];
      setGroupSummaries(rows);
      if (userId) {
        setMine(rows.find((r) => r.user_id === userId) ?? null);
      } else {
        setMine(null);
      }
    }
    setLoadingSummaries(false);
  }, [groupId, userId]);

  const fetchLatestWeeks = useCallback(async () => {
    setLoadingWeeks(true);
    // public.latest_week_ids (league, week_id)
    const { data, error } = await supabase
      .from('latest_week_ids')
      .select('league,week_id');

    if (!error && data) {
      const d = data as LatestWeekRow[];
      setLatestWeeks({
        cfb: d.find((x) => x.league === 'cfb')?.week_id ?? null,
        nfl: d.find((x) => x.league === 'nfl')?.week_id ?? null,
      });
    }
    setLoadingWeeks(false);
  }, []);

  useEffect(() => {
    fetchGroup();
    fetchMembers();
    fetchSummaries();
    fetchLatestWeeks();
  }, [fetchGroup, fetchMembers, fetchSummaries, fetchLatestWeeks]);

  const name = group?.name ?? 'Group';

  /* ------------------------------- Rendering ------------------------------ */

  const renderMember = useCallback(
    ({ item }: { item: MemberRow }) => {
      const dn = item.display_name ?? item.user_id;
      return (
        <View style={styles.row}>
          <View style={styles.rowTop}>
            {/* Avatar (optional) */}
            {item.avatar_url ? (
              <Image
                source={{ uri: item.avatar_url }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]} />
            )}

            <Text style={styles.rowTitle}>{dn}</Text>
          </View>

          <Text style={styles.rowSub}>
            {item.role}{' '}
            {item.joined_at ? (
              <>
                • joined{' '}
                {new Date(item.joined_at).toLocaleDateString()}
              </>
            ) : null}
          </Text>
        </View>
      );
    },
    []
  );

  const myCFB = mine?.cfb_picks ?? 0;
  const myNFL = mine?.nfl_picks ?? 0;

  const canPickCFB = latestWeeks.cfb !== null;
  const canPickNFL = latestWeeks.nfl !== null;

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>{name}</Text>

      {/* This Week's Picks */}
      <Text style={styles.h2}>This Week’s Picks</Text>
      <View style={styles.card}>
        {!userId ? (
          <Text style={styles.muted}>Sign in to see your picks.</Text>
        ) : loadingSummaries ? (
          <ActivityIndicator />
        ) : (
          <View>
            <View style={styles.gridHeader}>
              <Text style={[styles.gridCell, styles.gridUser]}>User</Text>
              <Text style={[styles.gridCell, styles.gridCol]}>CFB</Text>
              <Text style={[styles.gridCell, styles.gridCol]}>NFL</Text>
            </View>

            {mine ? (
              <View style={styles.gridRow}>
                <View style={[styles.gridCell, styles.gridUser]}>
                  <Text style={styles.rowTitle}>
                    {mine.display_name ?? mine.user_id}
                  </Text>
                </View>
                <View style={[styles.gridCell, styles.gridCol]}>
                  <Text style={styles.rowTitle}>{myCFB || '—'}</Text>
                </View>
                <View style={[styles.gridCell, styles.gridCol]}>
                  <Text style={styles.rowTitle}>{myNFL || '—'}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.muted}>No picks yet this week.</Text>
            )}

            <Pressable onPress={fetchSummaries} style={styles.refreshBtn}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Make your picks */}
      <Text style={styles.h2}>Make Your Picks</Text>
      <View style={styles.card}>
        {/* CFB */}
        <Text style={styles.sectionTitle}>College Football</Text>
        {loadingWeeks ? (
          <ActivityIndicator />
        ) : canPickCFB ? (
          <Link href="/college" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkText}>Go to CFB picks</Text>
            </Pressable>
          </Link>
        ) : (
          <Text style={styles.muted}>No CFB week found.</Text>
        )}

        {/* NFL */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>NFL</Text>
        {loadingWeeks ? (
          <ActivityIndicator />
        ) : canPickNFL ? (
          <Link href="/picks" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkText}>Go to NFL picks</Text>
            </Pressable>
          </Link>
        ) : (
          <Text style={styles.muted}>No NFL week found.</Text>
        )}
      </View>

      {/* Members */}
      <Text style={styles.h2}>Members</Text>
      <View style={styles.card}>
        {loadingMembers ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(m) => m.user_id}
            renderItem={renderMember}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={
              <Text style={styles.muted}>No members yet.</Text>
            }
          />
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  h2: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#f4f5f6',
    borderRadius: 10,
    padding: 12,
  },
  muted: {
    color: '#6b7280',
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },

  /* grid for "This Week’s Picks" */
  gridHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
    paddingBottom: 6,
    marginBottom: 6,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  gridCell: { paddingRight: 8 },
  gridUser: { flex: 1.5 },
  gridCol: { flex: 1, alignItems: 'flex-end' },

  /* buttons / links */
  refreshBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshText: {
    fontWeight: '600',
  },
  linkBtn: {
    backgroundColor: '#091f1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  linkText: {
    color: 'white',
    fontWeight: '700',
  },

  /* member rows */
  row: {},
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    marginTop: 2,
    color: '#6b7280',
  },
  sep: { height: 10 },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
  },
  avatarFallback: {
    backgroundColor: '#cbd5e1',
  },
});
