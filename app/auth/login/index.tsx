export const unstable_settings = { prerender: false };

import { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { supabase } from '../../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');

  /** Send Supabase magic-link email */
  const sendMagicLink = async () => {
    if (!email) {
      Alert.alert('Please enter an email address');
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Deep-link back into the app after the user clicks the email link.
        // Change to your custom scheme if you’ve set one up.
        emailRedirectTo: 'weekendlocks://auth',
      },
    });

    if (error) {
      Alert.alert('Login failed', error.message);
    } else {
      Alert.alert('Success', 'Check your email for the login link!');
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
