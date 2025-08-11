import { useEffect, useState } from "react";
import { View, TextInput, Button, Alert, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";
import { hardSignOut } from "@/lib/auth";

const redirectTo =
  (typeof window !== "undefined" ? window.location.origin : "") + "/auth/callback";

export default function Login() {
  const [email, setEmail] = useState("");

  useEffect(() => { hardSignOut(); }, []);

  async function sendLink() {
    if (!email.trim()) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    });
    if (error) Alert.alert("Login failed", error.message);
    else Alert.alert("Check your email", "Tap the link to finish signing in.");
  }

  return (
    <View style={styles.box}>
      <TextInput
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <Button title="Send login link" onPress={sendLink} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 12, fontSize: 16 },
});
