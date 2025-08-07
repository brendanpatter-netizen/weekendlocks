import { Link } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekend Locks</Text>
      <Text style={styles.subtitle}>
        Social picks • Leaderboards • Bragging rights
      </Text>

      <Link href="/auth/login" style={styles.link}>
        Get started →
      </Link>
      {/* NEW Picks link */}
      <Link href="/picks/page" style={styles.link}>Picks →</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 120, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 12 },
  subtitle: { fontSize: 18, color: '#666', textAlign: 'center' },
  link: { marginTop: 30, fontSize: 18, color: '#0070f3' }
});
