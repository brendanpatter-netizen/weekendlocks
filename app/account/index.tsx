export const unstable_settings = { prerender: false };

import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { alert } from "@/lib/alert";
import { colors as theme } from "@/lib/theme";
import TapeCorner from "@/components/TapeCorner";

const colors = {
  primary: theme.brand,
  bg: theme.felt,
  text: "#0C1712",
  subtext: "#45564C",
};

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Load email + display name
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");

      // Read profile (just id, username)
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("profiles read error:", error);
        return;
      }

      // Use DB value or sensible default
      const fallback =
        user.user_metadata?.name ||
        (user.email ? user.email.split("@")[0] : "User");

      setUsername((data?.username ?? fallback).replace(/\s/g, ""));
    })();
  }, []);

  // Save via RPC (security definer)
  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      const clean = (username ?? "").trim();

    // Call the RPC (now returns the saved row as JSON)
    const { data, error } = await supabase.rpc("save_profile", {
      p_username: clean,
    });

    if (error) {
      // This logs Postgres' exact message (super useful if anything is off)
      console.warn("save_profile RPC error:", error);
      throw error;
    }

    // Optional: reflect the DB result back into UI
    if (data?.username !== undefined) {
      setUsername((data.username ?? "").toString());
    }

    alert("Saved", "Profile updated.");
  } catch (e: any) {
    alert("Couldn’t save", e?.message ?? "Please try again.");
  } finally {
    setSavingProfile(false);
  }
};

  const savePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords don’t match", "Please re-enter.");
      return;
    }
    try {
      setSavingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      alert("Password set", "You can now sign in with email + password.");
    } catch (e: any) {
      alert("Couldn’t update password", e?.message ?? "Please try again.");
    } finally {
      setSavingPassword(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      if (typeof window !== "undefined") window.location.assign("/auth/login");
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <TapeCorner />
        <Text style={styles.title}>My Account</Text>

        {/* Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{email || "—"}</Text>
          </View>

          {!!phone && (
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{phone}</Text>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>Display name (username)</Text>
            <TextInput
              placeholder="e.g. weekend_wizard"
              autoCapitalize="none"
              value={username}
              onChangeText={(t) => setUsername(t.replace(/\s/g, ""))}
              style={styles.input}
            />
            <Pressable onPress={saveProfile} disabled={savingProfile} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>
                {savingProfile ? "Saving..." : "Save profile"}
              </Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 12, color: colors.subtext }}>
            Your name is stored in the <Text style={{ fontWeight: "700" }}>profiles</Text> table and
            shows in Groups.
          </Text>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Set / change password</Text>
            <TextInput
              placeholder="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
            />
            <TextInput
              placeholder="Confirm new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
            />
            <Pressable onPress={savePassword} disabled={savingPassword} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>
                {savingPassword ? "Saving..." : "Update password"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    alignItems: "center",
  },
  // The whole page is one card — a single-instance surface, so it gets the
  // full paper treatment (dashed border, tape corner, slight tilt).
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#F5F3E7",
    borderRadius: 10,
    padding: 20,
    paddingTop: 24,
    gap: 16,
    borderWidth: 1.5,
    borderColor: "rgba(12,23,18,0.18)",
    borderStyle: "dashed",
  },
  title: { fontFamily: "PermanentMarker_400Regular", fontSize: 24, color: "#B23A2E", textTransform: "uppercase" },
  section: { gap: 10 },
  sectionTitle: { fontFamily: "PermanentMarker_400Regular", fontSize: 16, color: "#B23A2E", textTransform: "uppercase" },
  row: {
    backgroundColor: "#FDFCF8",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(12,23,18,0.12)",
    gap: 8,
  },
  label: { fontSize: 12, color: colors.subtext, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 16, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: "rgba(12,23,18,0.18)",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    fontSize: 16,
    color: colors.text,
  },
  primaryBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  primaryBtnText: { color: "white", fontWeight: "800" },
  // Ghost/secondary, matching the documented button pattern — not a filled
  // gold button, which isn't a component this design system defines.
  signOutBtn: {
    alignSelf: "flex-start",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  signOutText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
});
