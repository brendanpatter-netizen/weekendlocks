import { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        console.error(error);
        return;
      }
      if (user) {
        setEmail(user.email || "");
        setDisplayName(user.user_metadata?.display_name || "");
      }
    };
    getUser();
  }, []);

  const saveProfile = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName },
    });
    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", "Profile updated");
    }
  };

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setLoading(false);
      Alert.alert("Error", error.message);
      return;
    }

    // Mark that password is set so we don't redirect again
    const { error: metaError } = await supabase.auth.updateUser({
      data: { password_set: true },
    });

    setLoading(false);

    if (metaError) {
      Alert.alert("Error", metaError.message);
      return;
    }

    Alert.alert("Success", "Password updated");
    router.replace("/"); // ✅ Send them home after saving
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Account</Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{email}</Text>

      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <Button
        title={loading ? "Saving..." : "Save profile"}
        onPress={saveProfile}
        disabled={loading}
      />

      <Text style={[styles.label, { marginTop: 20 }]}>New Password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <Text style={styles.label}>Confirm New Password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      <Button
        title={loading ? "Updating..." : "Update password"}
        onPress={savePassword}
        disabled={loading}
      />

      <View style={{ marginTop: 20 }}>
        <Button title="Sign out" onPress={signOut} color="#d9534f" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    maxWidth: 500,
    marginHorizontal: "auto",
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  label: {
    fontWeight: "bold",
    marginTop: 10,
  },
  value: {
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 4,
  },
});
