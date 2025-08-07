// app/picks/page.tsx
export const unstable_settings = { prerender: false };  // client-side fetch

import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useOdds } from '../../lib/useOdds';

export default function PicksPage() {
  const { data, error, loading } = useOdds(); // default NFL

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error)   return <Text style={styles.center}>Error: {error.message}</Text>;
  if (!data?.length) return <Text style={styles.center}>No games found.</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {data.map(game => {
        const bm = game.bookmakers[0];           // first bookmaker
        const market = bm?.markets?.[0];         // first market (spreads)
        const home = market?.outcomes.find(o => o.name === game.home_team);
        const away = market?.outcomes.find(o => o.name === game.away_team);

        return (
          <View key={game.id} style={styles.card}>
            <Text style={styles.match}>
              {game.away_team} @ {game.home_team}
            </Text>
            {home && away && (
              <Text>
                Spread: {away.name} {away.point} / {home.name} {home.point}
              </Text>
            )}
            <Text style={styles.book}>Bookmaker: {bm?.title ?? 'n/a'}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { padding: 16, gap: 12 },
  card: { padding: 12, borderWidth: 1, borderRadius: 8, borderColor: '#ccc' },
  match: { fontWeight: 'bold', marginBottom: 4, fontSize: 16 },
  book: { marginTop: 4, fontSize: 12, opacity: 0.7 },
});
