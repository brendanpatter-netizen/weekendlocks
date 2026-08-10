// FILE: app/index.tsx
export const unstable_settings = { prerender: false };

import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  return (
    <View style={styles.page}>
      <Text style={styles.h1}>WeekendLocks</Text>
      <Text style={styles.sub}>Make your NFL and college football picks with your group.</Text>

      <View style={styles.card}>
        {signedIn ? (
          <>
            <Text style={styles.h2}>Your groups</Text>
            <Text style={styles.body}>Open a group to see this week's picks and make your own.</Text>
            <Link href="/groups" style={styles.cta}>Go to Groups</Link>
          </>
        ) : (
          <>
            <Text style={styles.h2}>Get started</Text>
            <Text style={styles.body}>Sign in to join or create a group and start picking.</Text>
            <Link href="/auth/login" style={styles.cta}>Sign in</Link>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, gap: 12 },
  h1: { fontSize: 24, fontWeight: "800" },
  sub: { color: "#475569" },
  card: { backgroundColor: "#eee", borderRadius: 8, padding: 16, gap: 8, marginTop: 8 },
  h2: { fontSize: 16, fontWeight: "700" },
  body: { color: "#334155" },
  cta: {
    alignSelf: "flex-start", marginTop: 4, paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: "#0B735F", color: "#fff", borderRadius: 8, fontWeight: "700" as any,
  },
});
