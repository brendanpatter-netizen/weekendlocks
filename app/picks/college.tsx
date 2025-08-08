// app/picks/college.tsx – NCAA Division‑I picks
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
import { Link } from 'expo-router';             // ← navigation
import { useOdds } from '../../lib/useOdds';
import { logoSrc } from '../../lib/teamLogos';

type BetType = 'spreads' | 'totals' | 'h2h';
const SPORT: string = 'americanfootball_ncaaf';   // Odds‑API key for college

export default function CollegePicksPage() {
  /* ---------- state ---------- */
  const [betType, setBetType] = useState<BetType>('spreads');

  /* ---------- fetch odds ---------- */
  const { data, error, loading } = useOdds(SPORT); // no week filter for CFB

  /* ---------- status UI ---------- */
  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error)   return <Text style={styles.center}>Error: {error.message}</Text>;
  if (!data?.length) return (
    <View style={styles.center}><Text>No games found.</Text></View>
  );

  /* ---------- render ---------- */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* header with link back to NFL */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>NCAA Picks</Text>
        <Link href={{ pathname: '/picks/page' }} style={styles.switch}>
          NFL ↗︎
        </Link>
      </View>

      {/* bet‑type tabs */}
      <View style={styles.tabs}>
        {(['spreads','totals','h2h'] as BetType[]).map(t => (
          <Pressable
            key={t}
            onPress={() => setBetType(t)}
            style={[styles.tab, betType===t && styles.tabActive]}
          >
            <Text style={betType===t && styles.tabActiveText}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {/* game cards */}
      {data.map(game => {
        const book   = game.bookmakers[0];
        const market = book?.markets.find(m => m.key === betType);
        if (!market) return null;

        let lineText = '';
        if (betType==='spreads' || betType==='h2h') {
          const home = market.outcomes.find(o => o.name===game.home_team);
          const away = market.outcomes.find(o => o.name===game.away_team);
          if (!home||!away) return null;
          lineText = betType==='spreads'
            ? `${away.name} ${away.point} / ${home.name} ${home.point}`
            : `ML: ${away.price} / ${home.price}`;
        } else {
          const over  = market.outcomes.find(o => o.name==='Over');
          const under = market.outcomes.find(o => o.name==='Under');
          if (!over||!under) return null;
          lineText = `Total ${over.point}  Over ${over.price} / Under ${under.price}`;
        }

        return (
          <View key={game.id} style={styles.card}>
            <View style={styles.logosRow}>
              <Image source={logoSrc(game.away_team)} style={styles.logo} />
              <Text style={styles.vs}>@</Text>
              <Image source={logoSrc(game.home_team)} style={styles.logo} />
            </View>
            <Text style={styles.match}>{game.away_team} @ {game.home_team}</Text>
            <Text>{lineText}</Text>
            <Text style={styles.kick}>{new Date(game.commence_time).toLocaleString()}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  center:      { flex:1, justifyContent:'center', alignItems:'center', padding:24 },
  container:   { padding:16, gap:12 },
  /* header */
  headerRow:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  title:       { fontSize:20, fontWeight:'600' },
  switch:      { color:'#0a84ff', fontSize:16 },
  /* tabs */
  tabs:        { flexDirection:'row', marginBottom:12 },
  tab:         { flex:1, padding:8, borderWidth:1, borderColor:'#999', alignItems:'center' },
  tabActive:   { backgroundColor:'#000' },
  tabActiveText:{ color:'#fff' },
  /* card */
  card:        { padding:12, borderWidth:1, borderRadius:8, borderColor:'#ccc' },
  match:       { fontWeight:'bold', marginBottom:4, fontSize:16 },
  kick:        { marginTop:4, fontSize:12, opacity:0.7 },
  /* logos */
  logosRow:    { flexDirection:'row', alignItems:'center', justifyContent:'center', columnGap:8, marginBottom:6 },
  logo:        { width:42, height:42, borderRadius:21 },
  vs:          { fontWeight:'bold', fontSize:16 },
});
