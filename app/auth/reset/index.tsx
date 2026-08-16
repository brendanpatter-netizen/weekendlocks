// app/auth/reset/index.tsx
export const unstable_settings = { prerender: false };

import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { alert } from "@/lib/alert";
import { colors as theme } from "@/lib/theme";
import TapeCorner from "@/components/TapeCorner";

const colors = { primary: theme.brand, bg: theme.felt, text: "#0C1712", subtext: "#45564C" };

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  // When user lands from email link, exchange code for a session.
  // window only exists on web — guarded so this doesn't throw on native.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          // Handles links with ?code=... or #access_token=...
          await supabase.auth.exchangeCodeForSession(window.location.href);
        }
      } catch {
        // ignore — user may already have a session
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    if (!password || password.length < 8) {
      alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      alert("Passwords don’t match", "Please re-enter.");
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Optional: mark password_set for first-time users
      await supabase.auth.updateUser({ data: { password_set: true } });

      alert("Password updated", "You can now sign in with your password.");
      router.replace("/auth/login");
    } catch (e: any) {
      alert("Could not update password", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color="#F5F3E7" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <TapeCorner />
        <Text style={styles.title}>Reset password</Text>

        <TextInput
          placeholder="New password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <TextInput
          placeholder="Confirm new password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          style={styles.input}
        />

        <Pressable onPress={save} disabled={saving || !password || !confirm} style={styles.cta}>
          <Text style={styles.ctaText}>{saving ? "Saving..." : "Save new password"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    position: "relative",
    width: "100%", maxWidth: 520, backgroundColor: "#F5F3E7", borderRadius: 10, padding: 20, paddingTop: 24, gap: 12,
    borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)", borderStyle: "dashed",
    ...Platform.select({
      web: { boxShadow: "0 12px 28px rgba(0,0,0,0.2)" },
      default: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    }),
  },
  title: { fontFamily: "PermanentMarker_400Regular", fontSize: 22, color: "#B23A2E", textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "rgba(12,23,18,0.18)", borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: "#FDFCF8", color: colors.text },
  cta: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  ctaText: { color: "white", fontWeight: "800" },
});
