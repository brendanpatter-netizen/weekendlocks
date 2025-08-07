import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useOdds } from '../lib/useOdds';

export default function PicksPage() {
  const { data, error, loading } = useOdds();      // NFL by default

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error)    return <Text style={styles.center}>Error: {error.message}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {data!.map(game => (
        <View key={game.id} style={styles.card}>
          <Text style={styles.match}>
            {game.away_team} @ {game.home_team}
          </Text>
          <Text>Bookmakers: {game.bookmakers.length}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { padding: 16, gap: 12 },
  card: { padding: 12, borderWidth: 1, borderRadius: 8, borderColor: '#ccc' },
  match: { fontWeight: 'bold', marginBottom: 4 },
});
