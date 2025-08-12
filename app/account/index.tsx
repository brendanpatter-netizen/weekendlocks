// app/account/index.tsx
import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Platform, Alert } from "react-native";
import {
  useFonts,
  RobotoCondensed_400Regular,
  RobotoCondensed_700Bold,
} from "@expo-google-fonts/roboto-condensed";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";

const colors = {
  primary: "#006241",
  secondary: "#FFD700",
  bg: "#F5F5F5",
  text: "#222",
  subtext: "#555",
};

export default function AccountPage() {
  const router = useRouter();

  const [loaded] = useFonts({
    RobotoCondensed_400Regular,
    RobotoCondensed_700Bold,
  });

  // don't block render on fonts
  const ffBold = loaded ? "RobotoCondensed_700Bold" : undefined;
  const ffReg = loaded ? "RobotoCondensed_400Regular" : undefined;

  // profile state
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const user = data.user;
      setEmail(user?.email ?? "");
      const meta = (user?.user_metadata as any) || {};
      setDisplayName(meta.display_name ?? "");
      setUsername(meta.username ?? "");
    });
    return () => { mounted = false; };
  }, []);

  // Save display name + username
  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName || null,
          username: username || null,
        },
      });
      if (error) throw error;
      Alert.alert("Saved", "Profile updated.");
    } catch (e: any) {
      Alert.alert("Couldn’t save", e?.message ?? "Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Set / change password
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

      // 1) update password
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) throw pwError;

      // 2) mark that a password exists so the app won't keep redirecting
      const { error: metaError } = await supabase.auth.updateUser({
        data: { password_set: true },
      });
      if (metaError) throw metaError;

      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password set", "You can now sign in with email + password.");
      router.replace("/"); // send them home after success
    } catch (e: any) {
      Alert.alert("Couldn’t update password", e?.message ?? "Please try again.");
    } finally {
      setSavingPassword(false);
    }
  };

  // Robust sign-out
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
        <Text style={[styles.title, { fontFamily: ffBold }]}>My Account</Text>

        {/* Profile */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: ffBold }]}>Profile</Text>

          <View style={styles.row}>
            <Text style={[styles.label, { fontFamily: ffBold }]}>Email</Text>
            <Text style={[styles.value, { fontFamily: ffReg }]}>{email || "—"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { fontFamily: ffBold }]}>Display name</Text>
            <TextInput
              placeholder="Your name"
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { fontFamily: ffBold }]}>Username</Text>
            <TextInput
              placeholder="e.g. weekend_wizard"
              autoCapitalize="none"
              value={username}
              onChangeText={(t) => setUsername(t.replace(/\s/g, ""))}
              style={styles.input}
            />
            <Pressable onPress={saveProfile} disabled={savingProfile} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{savingProfile ? "Saving..." : "Save profile"}</Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 12, color: colors.subtext }}>
            Note: username is stored in your profile. (We can add “login by username” later.)
          </Text>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: ffBold }]}>Security</Text>

          <View style={styles.row}>
            <Text style={[styles.label, { fontFamily: ffBold }]}>Set / change password</Text>
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
          <Text style={[styles.signOutText, { fontFamily: ffBold }]}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: colors.bg, padding: 20, alignItems: "center",
  },
  card: {
    width: "100%", maxWidth: 720, backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 16,
    ...Platform.select({
      web: { boxShadow: "0 12px 28px rgba(0,0,0,0.12)" },
      default: {
        shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 }, elevation: 8,
      },
    }),
  },
  title: { fontSize: 24, color: colors.primary, textTransform: "uppercase" },
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, color: colors.primary, textTransform: "uppercase" },
  row: { backgroundColor: "#FAFAFA", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#EEE", gap: 8 },
  label: { fontSize: 12, color: colors.subtext, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 16, color: colors.text },
  input: { borderWidth: 1, borderColor: "#DDD", borderRadius: 10, padding: 10, backgroundColor: "#fff", fontSize: 16 },
  primaryBtn: { alignSelf: "flex-start", backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  signOutBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    ...Platform.select({
      web: { boxShadow: "0 8px 18px rgba(0,0,0,0.1)" },
      default: {
        shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 }, elevation: 6,
      },
    }),
  },
  signOutText: { color: colors.primary, fontSize: 16 },
});
