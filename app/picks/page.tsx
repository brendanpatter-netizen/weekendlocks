// app/picks/page.tsx
export const unstable_settings = { prerender: false };

import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';     // expo install @react-native-picker/picker
import { getCurrentWeek } from '../../lib/nflWeeks';
import { useOdds } from '../../lib/useOdds';

export default function PicksPage() {
  const [week, setWeek] = useState(1);
  const { data, error, loading } = useOdds('americanfootball_nfl', week);

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error)   return <Text style={styles.center}>Error: {error.message}</Text>;
  if (!data?.length) return <Text style={styles.center}>No games found for week {week}.</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Picker selectedValue={week} onValueChange={setWeek} style={{ marginBottom: 12 }}>
        {[...Array(18)].map((_, i) => (
          <Picker.Item key={i + 1} label={`Week ${i + 1}`} value={i + 1} />
        ))}
      </Picker>

      {data.map(game => {
        const bm      = game.bookmakers[0];
        const market  = bm?.markets?.[0];
        const home    = market?.outcomes.find(o => o.name === game.home_team);
        const away    = market?.outcomes.find(o => o.name === game.away_team);

        return (
          <View key={game.id} style={styles.card}>
            <Text style={styles.match}>{game.away_team} @ {game.home_team}</Text>
            {home && away && (
              <Text>Spread: {away.name} {away.point} / {home.name} {home.point}</Text>
            )}
            <Text style={styles.book}>{new Date(game.commence_time).toLocaleString()}</Text>
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
