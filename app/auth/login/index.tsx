import { useEffect, useState } from "react";
import { View, TextInput, Button, Alert, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";
import { hardSignOut } from "@/lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");

  // guarantee fresh state
  useEffect(() => { hardSignOut(); }, []);

  async function sendLink() {
    const addr = email.trim();
    if (!addr) return;

    const redirectTo =
      (typeof window !== "undefined" ? window.location.origin : "") + "/auth/callback";

    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    });

    if (error) Alert.alert("Login failed", error.message);
    else {
      Alert.alert("Check your email", "Tap the link to finish signing in.");
      setEmail("");
    }
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
