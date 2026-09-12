// Prerendered so the invite link itself — the thing actually shared, not
// the homepage — carries a real social preview: link-unfurl bots (iMessage,
// Slack, Discord) read the initial static HTML's <head> and never run the
// app's JS, so these tags only reach them if baked in at build time. Safe
// to prerender: the real join logic lives in useEffect below, which never
// runs during a prerender pass anyway, so this only ever bakes in the
// generic "Joining…" shell — no session data touches the static output.
export const unstable_settings = { prerender: true };

import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import Head from "expo-router/head";
import { supabase } from "../../../lib/supabase";
import { alert } from "@/lib/alert";
import { colors as theme } from "@/lib/theme";

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

      const { data: gId, error: rpcErr } = await supabase.rpc(
        "join_group_via_code",
        { p_code: String(code) }
      );

      if (rpcErr || !gId) {
        alert("Not found", "No group found for that invite code.");
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
      <Head>
        <title>Join a group | WeekendLocks</title>
        <meta name="description" content="You've been invited to a WeekendLocks group — weekly NFL and college football picks with your crew." />
        <meta property="og:title" content="Join a WeekendLocks group" />
        <meta property="og:description" content="Weekly NFL and college football picks with your crew. One lock a week, bragging rights all season long." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://weekendlocks.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://weekendlocks.com/og-image.png" />
      </Head>
      {status === "joining" ? (
        <>
          <ActivityIndicator color="#F5F3E7" />
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
    backgroundColor: theme.felt,
  },
  muted: { color: "rgba(245,243,231,0.7)", fontWeight: "700" },
});
