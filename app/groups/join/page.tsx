import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function JoinGroupByUrl() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [status, setStatus] = useState<"joining" | "done">("joining");

  useEffect(() => {
    const run = async () => {
      if (!code) {
        setStatus("done");
        return router.replace("/groups");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return router.replace({
          pathname: "/account",
          params: { redirect: `/groups/join?code=${code}` },
        });
      }

      // Use the secure RPC instead of SELECT+INSERT
      const { data: gId, error: rpcErr } = await supabase.rpc(
        "join_group_via_code",
        { p_code: String(code) }
      );

      if (rpcErr || !gId) {
        Alert.alert("Not found", "No group found for that invite code.");
        setStatus("done");
        return router.replace("/groups");
      }

      setStatus("done");
      router.replace({ pathname: "/groups/[id]", params: { id: gId as string } });
    };

    run();
  }, [code]);

  return (
    <View style={styles.container}>
      {status === "joining" ? (
        <>
          <ActivityIndicator />
          <Text style={styles.muted}>Joining group…</Text>
        </>
      ) : (
        <Text style={styles.muted}>Redirecting…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { color: "#666" },
});
