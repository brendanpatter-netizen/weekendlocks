// components/Header.tsx
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, TextInput, Alert } from "react-native";
import { Link, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { hardSignOut } from "@/lib/auth";

const colors = {
  primary: "#006241",
  secondary: "#FFD700",
  textOnPrimary: "#FFFFFF",
  bg: "#F5F5F5",
  text: "#222",
  subtext: "#555",
};

export default function Header() {
  const [session, setSession] = useState<null | { user?: { email?: string } }>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");

  const userEmail = session?.user?.email;
  const initials = useMemo(() => (userEmail ? userEmail[0].toUpperCase() : "?"), [userEmail]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => mounted && setSession(data.session as any));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s as any));
    return () => sub.subscription.unsubscribe();
  }, []);

  const isSignedIn = !!userEmail;

  async function sendMagicLink() {
    if (!email.trim()) return;
    const redirectTo =
      (typeof window !== "undefined" ? window.location.origin : "") + "/auth/callback";

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    });
    if (error) Alert.alert("Login failed", error.message);
    else {
      Alert.alert("Check your email", "Tap the link to finish signing in.");
      setEmail("");
      setMenuOpen(false);
    }
  }

  async function signOut() {
    await hardSignOut();
    setMenuOpen(false);
    router.replace("/auth/login");
  }

  // When you simply want to route: if signed in -> /account, else -> /auth/login
  const accountHref = isSignedIn ? "/account" : "/auth/login";

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {/* Left nav */}
        <View style={styles.left}>
          <Link href="/" asChild>
            <Pressable><Text style={styles.nav}>Home</Text></Pressable>
          </Link>

          {/* Change pathname to "/picks" if your picks entry is app/picks/index.tsx */}
          <Link href={{ pathname: "/picks/page" }} asChild>
            <Pressable><Text style={styles.nav}>Picks</Text></Pressable>
          </Link>
        </View>

        {/* Center brand */}
        <Text style={styles.brand}>WEEKEND LOCKS</Text>

        {/* Right: Account */}
        <View style={styles.right}>
          {/* Avatar / initials (only when signed in) */}
          {isSignedIn && (
            <View style={styles.avatar}>
              <Text style={{ color: colors.primary, fontWeight: "800" }}>{initials}</Text>
            </View>
          )}

          {/* Clickable account label toggles a small panel;
              also acts as a normal link if you just want to navigate */}
          <Link href={accountHref as any} asChild>
            <Pressable onPress={() => setMenuOpen((v) => !v)}>
              <Text style={styles.nav}>Account</Text>
            </Pressable>
          </Link>

          {/* Inline panel */}
          {menuOpen && (
            <View style={styles.panel}>
              {!isSignedIn ? (
                <>
                  <Text style={styles.panelTitle}>Sign in</Text>
                  <TextInput
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                  />
                  <Pressable onPress={sendMagicLink} style={styles.panelBtn}>
                    <Text style={styles.panelBtnText}>Send login link</Text>
                  </Pressable>

                  {/* Full-page login route as backup */}
                  <Link href="/auth/login" asChild>
                    <Pressable>
                      <Text style={styles.panelLink}>Open login page →</Text>
                    </Pressable>
                  </Link>
                </>
              ) : (
                <>
                  <Text style={styles.panelTitle}>Signed in</Text>
                  <Text style={styles.panelText}>{userEmail}</Text>

                  <Link href="/account" asChild>
                    <Pressable style={[styles.panelBtn, styles.accountBtn]}>
                      <Text style={[styles.panelBtnText, { color: colors.primary }]}>
                        Go to Account
                      </Text>
                    </Pressable>
                  </Link>

                  <Pressable onPress={signOut}>
                    <Text style={styles.panelLink}>Sign out</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: colors.primary,
    ...Platform.select({
      web: { boxShadow: "0 2px 12px rgba(0,0,0,0.18)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      },
    }),
    zIndex: 50,
  },
  bar: {
    height: 64,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  left: { flexDirection: "row", gap: 16, minWidth: 120 },
  right: { flexDirection: "row", gap: 12, alignItems: "center", position: "relative" },
  brand: {
    color: colors.textOnPrimary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  nav: {
    color: colors.textOnPrimary,
    opacity: 0.95,
    fontSize: 16,
    fontWeight: "700",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    position: "absolute",
    top: 44,
    right: 0,
    width: 280,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    ...Platform.select({
      web: { boxShadow: "0 16px 32px rgba(0,0,0,0.18)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      },
    }),
  },
  panelTitle: { fontWeight: "800", color: colors.primary },
  panelText: { color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
  },
  panelBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  panelBtnText: { color: "#fff", fontWeight: "800" },
  accountBtn: { backgroundColor: colors.secondary },
  panelLink: { color: colors.primary, textDecorationLine: "underline", marginTop: 6 },
});
