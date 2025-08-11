import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams(); // grabs query params on web

  useEffect(() => {
    const handleSession = async () => {
      // ❶ Build the full URL that the browser/mobile app is currently on
      const url = Linking.createURL(window.location.pathname + window.location.search);

      const { data, error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) {
        Alert.alert('Login failed', error.message);
        router.replace('/');          // back to home on error
      } else {
        // ✅ User is now logged in
        router.replace('/picks/page');     // or '/league/page' etc.
      }
    };

    handleSession();
  }, []);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
