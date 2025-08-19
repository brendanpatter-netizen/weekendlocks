import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";

const colors = {
  primary: "#006241",
  secondary: "#FFD700",
  bg: "#F5F5F5",
  text: "#222",
  subtext: "#555",
};

export default function AccountPage() {
  const [email, setEmail] = useState("");
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

    Alert.alert("Saved", "Profile updated.");
  } catch (e: any) {
    Alert.alert("Couldn’t save", e?.message ?? "Please try again.");
  } finally {
    setSavingProfile(false);
  }
};

  const savePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don’t match", "Please re-enter.");
      return;
    }
    try {
      setSavingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password set", "You can now sign in with email + password.");
    } catch (e: any) {
      Alert.alert("Couldn’t update password", e?.message ?? "Please try again.");
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
        <Text style={styles.title}>My Account</Text>

        {/* Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{email || "—"}</Text>
          </View>

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
  card: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "#eaeaea",
  },
  title: { fontSize: 24, color: colors.primary, textTransform: "uppercase", fontWeight: "700" },
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, color: colors.primary, textTransform: "uppercase", fontWeight: "700" },
  row: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEE",
    gap: 8,
  },
  label: { fontSize: 12, color: colors.subtext, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 16, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  primaryBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  signOutBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  signOutText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
});
