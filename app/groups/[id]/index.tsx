'use client';

import { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase'; // ← change this path if needed

type MemberRow = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = String(id);

  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [groupName, setGroupName] = useState<string>('');
  const [members, setMembers] = useState<MemberRow[]>([]);

  async function load() {
    setLoading(true);
    setNotAllowed(false);

    // Must be signed in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setNotAllowed(true);
      setLoading(false);
      return;
    }

    // Access check (owner OR member)
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

    // Fetch member rows with profile fields via the view
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

    setLoading(false);
  }

  useEffect(() => { load(); }, [groupId]);

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
                  // simple web <img>; fine for Next/Expo web
                  <img
                    src={item.avatar_url}
                    alt={name}
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

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 8 },
  h1: { fontSize: 22, fontWeight: '600' },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  muted: { color: '#666' },
  row: { backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rowTitle: { fontWeight: '600' },
  rowSub: { color: '#666' },
});
