import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const SUPABASE_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL as string) ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
  (Constants.expoConfig?.extra as any)?.supabaseUrl;

const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ||
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
  (Constants.expoConfig?.extra as any)?.supabaseAnonKey;

const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

export default function JoinGroupByUrl() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [status, setStatus] = useState<"joining" | "done">("joining");

  useEffect(() => {
    const run = async () => {
      if (!code) { setStatus("done"); return router.replace("/groups"); }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace({ pathname: "/account", params: { redirect: `/groups/join?code=${code}` } });

      const { data: g, error: gErr } = await supabase.from("groups").select("id, invite_code").eq("invite_code", String(code)).single();
      if (gErr || !g) { Alert.alert("Not found", "No group found for that invite code."); setStatus("done"); return router.replace("/groups"); }

      const { error: mErr } = await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
      if (mErr) { Alert.alert("Error", mErr.message); setStatus("done"); return router.replace("/groups"); }

      setStatus("done");
      router.replace({ pathname: "/groups/[id]", params: { id: g.id } });
    };

    run();
  }, [code]);

  return (
    <View style={styles.container}>
      {status === "joining" ? (<><ActivityIndicator /><Text style={styles.muted}>Joining group…</Text></>) : (<Text style={styles.muted}>Redirecting…</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8, alignItems: "center", justifyContent: "center" },
  muted: { color: "#666" },
});
