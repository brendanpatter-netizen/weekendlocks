'use client';

import { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase'; // adjust path if your client is elsewhere

type Member = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
};

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = String(id);

  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [groupName, setGroupName] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);

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

    // ✅ Check access via groups_for_me (owner OR member)
    const { data: grp, error: grpErr } = await supabase
      .from('groups_for_me')
      .select('*')
      .eq('id', groupId)
      .single();

    if (grpErr || !grp) {
      // If the user isn’t a member/owner, the view returns 0 rows.
      setNotAllowed(true);
      setLoading(false);
      return;
    }
    setGroupName(grp.name as string);

    // ✅ Now load all members of this group
    const { data: mems, error: memErr } = await supabase
      .from('group_members')
      .select('user_id, role, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (memErr) {
      // If you still see nothing here, double-check the group_members SELECT policy below.
      console.error('members error', memErr);
      setMembers([]);
    } else {
      setMembers((mems ?? []) as Member[]);
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
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.user_id}</Text>
            <Text style={styles.rowSub}>
              {item.role ?? 'member'}{item.joined_at ? ` • joined ${new Date(item.joined_at).toLocaleDateString()}` : ''}
            </Text>
          </View>
        )}
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
  row: { backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 8 },
  rowTitle: { fontWeight: '600' },
  rowSub: { color: '#666', marginTop: 2 },
});
