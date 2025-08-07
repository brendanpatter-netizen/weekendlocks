// app/auth/login/index.tsx
export const unstable_settings = { prerender: false };

import { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { supabase } from '../../../lib/supabase';

const redirectTo =
  process.env.NODE_ENV === 'development'
    ? `${window.location.origin}/auth/callback`
    : 'https://weekendlocks.com/auth/callback';

export default function Login() {
  const [email, setEmail] = useState('');

  const sendMagicLink = async () => {
    if (!email) {
      Alert.alert('Please enter an email address');
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      Alert.alert('Login failed', error.message);
    } else {
      Alert.alert('Success', 'Check your e-mail for the login link!');
      setEmail('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <Button title="Send Login Link" onPress={sendMagicLink} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    fontSize: 16,
  },
});
