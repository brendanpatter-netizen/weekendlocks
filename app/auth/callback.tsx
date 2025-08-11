import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    // After the hash is processed by Supabase, a session becomes available
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      // choose where to land post-login
      router.replace("/picks/page"); // or "/" if you prefer
    }, 400);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 8 }}>
      <ActivityIndicator />
      <Text>Finalizing sign-in…</Text>
    </View>
  );
}
