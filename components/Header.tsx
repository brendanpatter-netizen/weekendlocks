// components/Header.tsx
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, TextInput, Alert, ActivityIndicator } from "react-native";
import { Link, router } from "expo-router";
import { supabase } from "@/lib/supabase";

const colors = {
  primary: "#006241",
  secondary: "#FFD700",
  textOnPrimary: "#FFFFFF",
  bg: "#F5F5F5",
  text: "#222",
  subtext: "#555",
};

type Mode = "code" | "link";

export default function Header() {
  const [session, setSession] = useState<null | { user?: { email?: string } }>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // inline auth state
  const [mode, setMode] = useState<Mode>("code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const userEmail = session?.user?.email || undefined;
  const isSignedIn = !!userEmail;
  const initials = useMemo(() => (userEmail ? userEmail[0].toUpperCase() : "?"), [userEmail]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => mounted && setSession(data.session as any));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s as any));
    return () => sub.subscription.unsubscribe();
  }, []);

  const redirectTo =
    (typeof window !== "undefined" ? window.location.origin : "") + "/auth/callback";

  async function send() {
    const addr = email.trim();
    if (!addr) return;
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      if (mode === "code") {
        setCodeSent(true);
        Alert.alert("Code sent", "Enter the 6-digit code from your email.");
      } else {
        Alert.alert("Magic link sent", "Check your email to finish signing in.");
        setMenuOpen(false);
        setEmail("");
      }
    } catch (e: any) {
      Alert.alert("Couldn’t send", e?.message ?? "Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    const addr = email.trim();
    const token = code.trim();
    if (!addr || token.length !== 6) return;
    try {
      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({
        email: addr,
        token,
        type: "email",
      });
      if (error) throw error;
      setMenuOpen(false);
      setCode("");
      setEmail("");
      router.replace("/picks/page");
    } catch (e: any) {
      Alert.alert("Invalid code", e?.message ?? "Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      setMenuOpen(false);
      if (typeof window !== "undefined") window.location.assign("/auth/login");
    }
  }

  // Route targets
  const accountHref = isSignedIn ? "/account" : "/auth/login";

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {/* Left nav */}
        <View style={styles.left}>
          <Link href="/" asChild>
            <Pressable><Text style={styles.nav}>Home</Text></Pressable>
          </Link>

          {/* Picks */}
          <Link href="/picks/page" asChild>
            <Pressable><Text style={styles.nav}>Picks</Text></Pressable>
          </Link>
        </View>

        {/* Center brand */}
        <Text style={styles.brand}>WEEKEND LOCKS</Text>

        {/* Right: Account + panel */}
        <View style={styles.right}>
          {isSignedIn && (
            <View style={styles.avatar}>
              <Text style={{ color: colors.primary, fontWeight: "800" }}>{initials}</Text>
            </View>
          )}

          <Link href={accountHref as any} asChild>
            <Pressable onPress={() => setMenuOpen((v) => !v)}>
              <Text style={styles.nav}>Account</Text>
            </Pressable>
          </Link>

          {menuOpen && (
            <View style={styles.panelHelper}>
              {!isSignedIn ? (
                <>
                  <Text style={styles.panelTitle}>Sign in</Text>

                  {/* Toggle */}
                  <View style={styles.toggleRow}>
                    <Pressable
                      onPress={() => setMode("code")}
                      style={[styles.toggleBtn, mode === "code" && styles.toggleBtnActive]}
                    >
                      <Text style={[styles.toggleText, mode === "code" && styles.toggleTextActive]}>
                        6-Digit Code
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setMode("link")}
                      style={[styles.toggleBtn, mode === "link" && styles.toggleBtnActive]}
                    >
                      <Text style={[styles.toggleText, mode === "link" && styles.toggleTextActive]}>
                        Magic Link
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    placeholder="you@email.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                  />

                  <Pressable
                    onPress={send}
                    disabled={loading || !email.trim()}
                    style={[styles.panelBtn, (!email.trim() || loading) && styles.panelBtnDisabled]}
                  >
                    {loading ? <ActivityIndicator /> : (
                      <Text style={styles.panelBtnText}>
                        {mode === "code" ? (codeSent ? "Resend code" : "Send code") : "Send magic link"}
                      </Text>
                    )}
                  </Pressable>

                  {mode === "code" && codeSent && (
                    <>
                      <Text style={styles.panelHelper}>Enter the 6-digit code</Text>
                      <TextInput
                        placeholder="123456"
                        keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                        maxLength={6}
                        value={code}
                        onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
                        style={styles.codeInput}
                      />
                      <Pressable
                        onPress={verify}
                        disabled={loading || code.length !== 6}
                        style={[
                          styles.panelBtnOutline,
                          (loading || code.length !== 6) && styles.panelBtnDisabled,
                        ]}
                      >
                        {loading ? <ActivityIndicator /> : (
                          <Text style={styles.panelBtnOutlineText}>Verify & Sign in</Text>
                        )}
                      </Pressable>
                    </>
                  )}

                  {/* Full login page as backup */}
                  <Link href="/auth/login" asChild>
                    <Pressable>
                      <Text style={styles.panelLink}>Open full login page →</Text>
                    </Pressable>
                  </Link>
                </>
              ) : (
                <>
                  <Text style={styles.panelTitle}>Signed in</Text>
                  <Text style={styles.panelText}>{userEmail}</Text>

                  <Link href="/account" asChild>
                    <Pressable style={[styles.panelBtn, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.panelBtnText, { color: colors.primary }]}>Go to Account</Text>
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
    width: 28, height: 28, borderRadius: 999, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },

  /* Panel */
  panelHelper: {
    position: "absolute",
    top: 44,
    right: 0,
    width: 300,
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
  panelLink: { color: colors.primary, textDecorationLine: "underline", marginTop: 6 },

  /* Toggle */
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: "#ddd", alignItems: "center", backgroundColor: "#fff",
  },
  toggleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  toggleText: { fontWeight: "700", color: colors.text },
  toggleTextActive: { color: "#fff" },

  /* Inputs & buttons */
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 10, fontSize: 16, backgroundColor: "#fff",
  },
  codeInput: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12,
    fontSize: 22, letterSpacing: 4, textAlign: "center", backgroundColor: "#fff",
  },
  panelBtn: {
    backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: "center",
  },
  panelBtnDisabled: { opacity: 0.6 },
  panelBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 0.2 },
  panelBtnOutline: {
    borderWidth: 2, borderColor: colors.primary, borderRadius: 12,
    alignItems: "center", paddingVertical: 12, backgroundColor: "#fff",
  },
  panelBtnOutlineText: { color: colors.primary, fontWeight: "800", letterSpacing: 0.2 },
});
