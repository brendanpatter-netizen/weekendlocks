'use client';

import { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase'; // ← change if your client lives elsewhere

type Member = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
};

export default function GroupDetailPage() {
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

    // ✅ Access check via view (returns a row only if user is owner/member)
    const { data: grp, error: grpErr } = await supabase
      .from('groups_for_me')
      .select('id,name')
      .eq('id', groupId)
      .single();

    // Debug (remove later)
    console.log('groupId param:', groupId, 'group row:', grp, 'grpErr:', grpErr?.message);

    if (grpErr || !grp) {
      setNotAllowed(true);
      setLoading(false);
      return;
    }
    setGroupName(grp.name as string);

    // ✅ Fetch members WITHOUT joins (RLS on group_members allows members to see all rows)
    const { data: mems, error: memErr, status } = await supabase
      .from('group_members')
      .select('user_id, role, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    // Debug (remove later)
    console.log('members status:', status, 'error:', memErr?.message, 'rows:', mems?.length);

    if (memErr) {
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
        <Text style={styles.muted}>
          Make sure you’re signed in and a member/owner of this group.
        </Text>
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
            {/* Replace user_id with username/avatar later via a view if desired */}
            <Text style={styles.rowTitle}>{item.user_id}</Text>
            <Text style={styles.rowSub}>
              {item.role ?? 'member'}
              {item.joined_at
                ? ` • joined ${new Date(item.joined_at).toLocaleDateString()}`
                : ''}
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
