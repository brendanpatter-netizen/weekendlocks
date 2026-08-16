export const unstable_settings = { prerender: false };

import { useEffect, useRef } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { alert } from "@/lib/alert";
import { colors as theme } from "@/lib/theme";

export default function Callback() {
  const router = useRouter();
  const settledRef = useRef(false);

  useEffect(() => {
    function settle(hasSession: boolean) {
      if (settledRef.current) return;
      settledRef.current = true;
      if (hasSession) {
        router.replace("/");
      } else {
        alert("Sign-in link didn't work", "That link may have expired or already been used — try signing in again.");
        router.replace("/auth/login");
      }
    }

    // Supabase processes the callback URL as soon as the client initializes —
    // if a session is already there, don't wait around for it.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) settle(true);
    });

    // Otherwise, react the moment the session actually lands...
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) settle(true);
    });

    // ...but don't wait forever if the link was bad.
    const timeout = setTimeout(() => settle(false), 4000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: theme.felt }}>
      <ActivityIndicator color="#F5F3E7" />
      <Text style={{ color: "rgba(245,243,231,0.7)", fontWeight: "700" }}>Finalizing sign-in…</Text>
    </View>
  );
}
