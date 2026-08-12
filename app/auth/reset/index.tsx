// app/auth/reset/index.tsx
export const unstable_settings = { prerender: false };

import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { alert } from "@/lib/alert";
import { colors as theme } from "@/lib/theme";

const colors = { primary: theme.brand, bg: theme.paper, text: theme.ink, subtext: theme.inkSoft };

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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
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
    width: "100%", maxWidth: 520, backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 12,
    ...Platform.select({
      web: { boxShadow: "0 12px 28px rgba(0,0,0,0.12)" },
      default: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    }),
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.primary, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: "#fff" },
  cta: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  ctaText: { color: "#fff", fontWeight: "800" },
});
