// app/picks/page.tsx
export const unstable_settings = { prerender: false };

import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getCurrentWeek } from '../../lib/nflWeeks';
import { useOdds } from '../../lib/useOdds';
import { logoSrc } from '../../lib/teamLogos';

type BetType = 'spreads' | 'totals' | 'h2h';

export default function PicksPage() {
  /* -------- state -------- */
  const [week, setWeek]   = useState<number>(getCurrentWeek() || 1);
  const [betType, setBetType] = useState<BetType>('spreads');

  /* -------- fetch -------- */
  const { data, error, loading } = useOdds('americanfootball_nfl', week);

  /* -------- status UI -------- */
  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error)   return <Text style={styles.center}>Error: {error.message}</Text>;
  if (!data?.length) {
    return (
      <View style={styles.center}>
        <Text>No games found for week {week}.</Text>
      </View>
    );
  }

  /* -------- render -------- */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Week picker */}
      <Picker
        selectedValue={week}
        onValueChange={val => setWeek(Number(val))}
        style={{ marginBottom: 12 }}
      >
        {[...Array(18)].map((_, i) => (
          <Picker.Item key={i + 1} label={`Week ${i + 1}`} value={i + 1} />
        ))}
      </Picker>

      {/* Bet-type tabs */}
      <View style={styles.tabs}>
        {(['spreads', 'totals', 'h2h'] as BetType[]).map(type => (
          <Pressable
            key={type}
            onPress={() => setBetType(type)}
            style={[styles.tab, betType === type && styles.tabActive]}
          >
            <Text style={betType === type && styles.tabActiveText}>
              {type.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Game cards */}
      {data.map(game => {
        const book = game.bookmakers[0];
        if (!book) return null;

        const market = book.markets.find(m => m.key === betType);
        if (!market) return null;

        /* helpers based on bet type */
        let lineText = '';

        if (betType === 'spreads' || betType === 'h2h') {
          const home = market.outcomes.find((o: any) => o.name === game.home_team);
          const away = market.outcomes.find((o: any) => o.name === game.away_team);
          if (!home || !away) return null;

          lineText =
            betType === 'spreads'
              ? `${away.name} ${away.point} / ${home.name} ${home.point}`
              : `ML: ${away.price} / ${home.price}`;
        } else if (betType === 'totals') {
          const over  = market.outcomes.find((o: any) => o.name === 'Over');
          const under = market.outcomes.find((o: any) => o.name === 'Under');
          if (!over || !under) return null;
          lineText = `Total ${over.point}  Over ${over.price} / Under ${under.price}`;
        }

        return (
          <View key={game.id} style={styles.card}>
            {/* Team logos graphic */}
            <View style={styles.logosRow}>
              <Image source={logoSrc(game.away_team)} style={styles.logo} />
              <Text style={styles.vs}>@</Text>
              <Image source={logoSrc(game.home_team)} style={styles.logo} />
            </View>

            <Text style={styles.match}>
              {game.away_team} @ {game.home_team}
            </Text>
            <Text>{lineText}</Text>
            <Text style={styles.kick}>
              {new Date(game.commence_time).toLocaleString()}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

/* -------- styles -------- */
const styles = StyleSheet.create({
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  container:   { padding: 16, gap: 12 },
  /* tabs */
  tabs:        { flexDirection: 'row', marginBottom: 12 },
  tab:         { flex: 1, padding: 8, borderWidth: 1, borderColor: '#999', alignItems: 'center' },
  tabActive:   { backgroundColor: '#000' },
  tabActiveText:{ color: '#fff' },
  /* card */
  card:        { padding: 12, borderWidth: 1, borderRadius: 8, borderColor: '#ccc' },
  match:       { fontWeight: 'bold', marginBottom: 4, fontSize: 16 },
  kick:        { marginTop: 4, fontSize: 12, opacity: 0.7 },
  /* logos */
  logosRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 8, marginBottom: 6 },
  logo:        { width: 42, height: 42, borderRadius: 21 },
  vs:          { fontWeight: 'bold', fontSize: 16 },
});
