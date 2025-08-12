// app/auth/login/index.tsx
import { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Alert, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

type Mode = "code" | "link" | "password";

const colors = {
  primary: "#006241",
  secondary: "#FFD700",
  bg: "#F5F5F5",
  text: "#222",
  subtext: "#555",
};

export default function Login() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("password"); // default to password for now
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const origin =
    typeof window !== "undefined" && window.location ? window.location.origin : "";
  const callbackUrl = origin + "/auth/callback";
  const resetUrl = origin + "/auth/reset";

  function setSafe(setter: (v: any) => void, val: any) {
    if (mountedRef.current) setter(val);
  }

  // OTP / Magic link
  async function send() {
    const addr = email.trim();
    if (!addr) return;
    setSafe(setLoading, true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { shouldCreateUser: true, emailRedirectTo: callbackUrl },
      });
      if (error) throw error;
      if (mode === "code") {
        setSafe(setCodeSent, true);
        Alert.alert("Code sent", "Enter the 6-digit code from your email.");
      } else {
        Alert.alert("Magic link sent", "Check your email to finish signing in.");
      }
    } catch (e: any) {
      console.error(e);
      setSafe(setFatal, e?.message ?? "Couldn’t send code/link.");
      Alert.alert("Couldn’t send", e?.message ?? "Try again.");
    } finally {
      setSafe(setLoading, false);
    }
  }

  async function verify() {
    const addr = email.trim();
    const token = code.trim();
    if (!addr || token.length !== 6) return;
    setSafe(setLoading, true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: addr, token, type: "email" });
      if (error) throw error;
      router.replace("/account"); // first-time flow will nudge here anyway
    } catch (e: any) {
      console.error(e);
      setSafe(setFatal, e?.message ?? "Couldn’t verify code.");
      Alert.alert("Invalid code", e?.message ?? "Check the code and try again.");
    } finally {
      setSafe(setLoading, false);
    }
  }

  // Password auth
  async function signInWithPassword() {
    const addr = email.trim();
    if (!addr || !password) return;
    setSafe(setLoading, true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
      if (error) throw error;
      router.replace("/picks/page");
    } catch (e: any) {
      console.error(e);
      setSafe(setFatal, e?.message ?? "Sign in failed.");
      Alert.alert("Sign in failed", e?.message ?? "Check your email/password and try again.");
    } finally {
      setSafe(setLoading, false);
    }
  }

  async function createWithPassword() {
    const addr = email.trim();
    if (!addr || !password) return;
    if (password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    setSafe(setLoading, true);
    try {
      const { error } = await supabase.auth.signUp({
        email: addr,
        password,
        options: { emailRedirectTo: callbackUrl },
      });
      if (error) throw error;
      Alert.alert("Check your email", "Confirm your email, then sign in with your password.");
    } catch (e: any) {
      console.error(e);
      setSafe(setFatal, e?.message ?? "Couldn’t create account.");
      Alert.alert("Couldn’t create account", e?.message ?? "Please try again.");
    } finally {
      setSafe(setLoading, false);
    }
  }

  async function sendReset() {
    const addr = email.trim();
    if (!addr) return;
    setSafe(setLoading, true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: resetUrl });
      if (error) throw error;
      Alert.alert("Password reset sent", "Check your email for the reset link.");
    } catch (e: any) {
      console.error(e);
      setSafe(setFatal, e?.message ?? "Couldn’t send reset.");
      Alert.alert("Couldn’t send reset", e?.message ?? "Try again.");
    } finally {
      setSafe(setLoading, false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Enter your email and choose a sign-in method.</Text>

        {/* Mode toggle */}
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setMode("code")} style={[styles.toggleBtn, mode === "code" && styles.toggleBtnActive]}>
            <Text style={[styles.toggleText, mode === "code" && styles.toggleTextActive]}>6-Digit Code</Text>
          </Pressable>
          <Pressable onPress={() => setMode("link")} style={[styles.toggleBtn, mode === "link" && styles.toggleBtnActive]}>
            <Text style={[styles.toggleText, mode === "link" && styles.toggleTextActive]}>Magic Link</Text>
          </Pressable>
          <Pressable onPress={() => setMode("password")} style={[styles.toggleBtn, mode === "password" && styles.toggleBtnActive]}>
            <Text style={[styles.toggleText, mode === "password" && styles.toggleTextActive]}>Password</Text>
          </Pressable>
        </View>

        {/* Shared email input */}
        <TextInput
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        {mode === "password" ? (
          <>
            <TextInput
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />

            <Pressable
              onPress={signInWithPassword}
              disabled={loading || !email.trim() || !password}
              style={[styles.cta, (!email.trim() || !password || loading) && styles.ctaDisabled]}
            >
              {loading ? <ActivityIndicator /> : <Text style={styles.ctaText}>Sign in</Text>}
            </Pressable>

            <Pressable
              onPress={createWithPassword}
              disabled={loading || !email.trim() || !password}
              style={[styles.ctaOutline, (!email.trim() || !password || loading) && styles.ctaOutlineDisabled]}
            >
              {loading ? <ActivityIndicator /> : <Text style={styles.ctaOutlineText}>Create account</Text>}
            </Pressable>

            <Pressable onPress={sendReset} disabled={loading || !email.trim()}>
              <Text style={{ color: colors.primary, textDecorationLine: "underline", textAlign: "center", marginTop: 8 }}>
                Forgot password?
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={send}
              disabled={loading || !email.trim()}
              style={[styles.cta, (!email.trim() || loading) && styles.ctaDisabled]}
            >
              {loading ? <ActivityIndicator /> : (
                <Text style={styles.ctaText}>
                  {mode === "code" ? (codeSent ? "Resend code" : "Send code") : "Send magic link"}
                </Text>
              )}
            </Pressable>

            {mode === "code" && codeSent && (
              <>
                <Text style={styles.helper}>Enter the 6-digit code</Text>
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
                  style={[styles.ctaOutline, (loading || code.length !== 6) && styles.ctaOutlineDisabled]}
                >
                  {loading ? <ActivityIndicator /> : <Text style={styles.ctaOutlineText}>Verify & Sign in</Text>}
                </Pressable>
              </>
            )}
          </>
        )}

        {!!fatal && (
          <Text selectable style={{ marginTop: 10, color: "#c00" }}>
            {fatal}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%", maxWidth: 520, backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 14,
    ...Platform.select({
      web: { boxShadow: "0 12px 28px rgba(0,0,0,0.12)" },
      default: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    }),
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.primary, textTransform: "uppercase" },
  subtitle: { color: colors.subtext, marginBottom: 6 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", alignItems: "center", backgroundColor: "#fff",
  },
  toggleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  toggleText: { fontWeight: "700", color: colors.text },
  toggleTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: "#fff" },
  cta: { marginTop: 4, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.2 },
  helper: { marginTop: 6, color: colors.subtext },
  codeInput: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12,
    fontSize: 22, letterSpacing: 4, textAlign: "center", backgroundColor: "#fff",
  },
  ctaOutline: {
    marginTop: 4, borderWidth: 2, borderColor: colors.primary, borderRadius: 12,
    alignItems: "center", paddingVertical: 12, backgroundColor: "#fff",
  },
  ctaOutlineDisabled: { opacity: 0.6 },
  ctaOutlineText: { color: colors.primary, fontWeight: "800", letterSpacing: 0.2 },
});
