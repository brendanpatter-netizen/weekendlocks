// app/league/[id].tsx
export const unstable_settings = { prerender: false };  // ← skip SSR

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
// import { supabase } from '../../lib/supabase';   // if you store leagues there

type League = {
  id: string;
  name: string;
  owner: string;
  members: number;
};

export default function LeagueDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [league, setLeague]   = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchLeague = async () => {
      try {
        // -- Replace with your real data source --------------------------
        // const { data, error } = await supabase
        //   .from('leagues')
        //   .select('*')
        //   .eq('id', id)
        //   .single();
        // if (error) throw error;
        // mock:
        const data = {
          id,
          name: `League #${id}`,
          owner: 'Demo Owner',
          members: 12,
        };
        // ---------------------------------------------------------------
        if (mounted) setLeague(data);
      } catch (e: any) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLeague();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error)   return <Text style={styles.center}>Error: {error}</Text>;
  if (!league) return <Text style={styles.center}>League not found.</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>{league.name}</Text>
      <Text style={styles.info}>Owner: {league.owner}</Text>
      <Text style={styles.info}>Members: {league.members}</Text>
      {/* add leaderboard component, etc. */}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { flex: 1, padding: 24, gap: 12 },
  h1: { fontSize: 28, fontWeight: 'bold' },
  info: { fontSize: 16, opacity: 0.8 },
});
