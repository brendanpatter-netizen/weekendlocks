// app/account/index.tsx
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import {
  useFonts,
  RobotoCondensed_400Regular,
  RobotoCondensed_700Bold,
} from "@expo-google-fonts/roboto-condensed";
import { supabase } from "@/lib/supabase";
import { hardSignOut } from "@/lib/auth"; // if you added this helper

const colors = {
  primary: "#006241",   // dark green
  secondary: "#FFD700", // gold
  bg: "#F5F5F5",
  text: "#222",
  subtext: "#555",
};

export default function AccountPage() {
  const [loaded] = useFonts({
    RobotoCondensed_400Regular,
    RobotoCondensed_700Bold,
  });
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? undefined));
  }, []);

  if (!loaded) return null;

  const signOut = async () => {
    try {
      await (hardSignOut ? hardSignOut() : supabase.auth.signOut());
    } finally {
      // no redirect here; header/login guard will handle it
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Account</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{email ?? "—"}</Text>
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
    ...Platform.select({
      web: { boxShadow: "0 12px 28px rgba(0,0,0,0.12)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      },
    }),
  },
  title: {
    fontFamily: "RobotoCondensed_700Bold",
    fontSize: 24,
    color: colors.primary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  row: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  label: {
    fontFamily: "RobotoCondensed_700Bold",
    fontSize: 12,
    color: colors.subtext,
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: "RobotoCondensed_400Regular",
    fontSize: 16,
    color: colors.text,
  },
  signOutBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    ...Platform.select({
      web: { boxShadow: "0 8px 18px rgba(0,0,0,0.1)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      },
    }),
  },
  signOutText: {
    fontFamily: "RobotoCondensed_700Bold",
    color: colors.primary,
    fontSize: 16,
  },
});
