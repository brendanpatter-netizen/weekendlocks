// app/auth/login/index.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { hardSignOut } from "@/lib/auth";

type Mode = "code" | "link";

const colors = {
  primary: "#006241",   // dark green
  secondary: "#FFD700", // gold
  bg: "#F5F5F5",
  text: "#222",
  subtext: "#555",
};

export default function Login() {
  const router = useRouter();

  // UI state
  const [mode, setMode] = useState<Mode>("code"); // "code" | "link"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Guarantee fresh state (kills any ghost sessions)
  useEffect(() => {
    hardSignOut();
  }, []);

  const redirectTo =
    (typeof window !== "undefined" ? window.location.origin : "") + "/auth/callback";

  async function send() {
    const addr = email.trim();
    if (!addr) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo, // ensures a magic link when mode==="link"
        },
      });
      if (error) throw error;

      if (mode === "code") {
        setCodeSent(true);
        Alert.alert("Code sent", "Enter the 6-digit code from your email.");
      } else {
        Alert.alert("Magic link sent", "Check your email to finish signing in.");
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
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: addr,
        token,
        type: "email", // 6-digit code via email
      });
      if (error) throw error;

      // Where to go after successful sign-in:
      // If your picks entry is app/picks/index.tsx -> "/picks"
      // If it's app/picks/page.tsx -> "/picks/page"
      router.replace("/picks/page");
    } catch (e: any) {
      Alert.alert("Invalid code", e?.message ?? "Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>
          Enter your email and choose a sign-in method.
        </Text>

        {/* Mode toggle */}
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

        {/* Email input */}
        <TextInput
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        {/* Send button */}
        <Pressable
          onPress={send}
          disabled={loading || !email.trim()}
          style={[styles.cta, (!email.trim() || loading) && styles.ctaDisabled]}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.ctaText}>
              {mode === "code" ? (codeSent ? "Resend code" : "Send code") : "Send magic link"}
            </Text>
          )}
        </Pressable>

        {/* Code entry for OTP mode */}
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
              style={[
                styles.ctaOutline,
                (loading || code.length !== 6) && styles.ctaOutlineDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.ctaOutlineText}>Verify & Sign in</Text>
              )}
            </Pressable>
          </>
        )}
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
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 14,
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
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
  },
  subtitle: {
    color: colors.subtext,
    marginBottom: 6,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  toggleBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontWeight: "700",
    color: colors.text,
  },
  toggleTextActive: {
    color: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  cta: {
    marginTop: 4,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  helper: {
    marginTop: 6,
    color: colors.subtext,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    fontSize: 22,
    letterSpacing: 4,
    textAlign: "center",
    backgroundColor: "#fff",
  },
  ctaOutline: {
    marginTop: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  ctaOutlineDisabled: { opacity: 0.6 },
  ctaOutlineText: {
    color: colors.primary,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
