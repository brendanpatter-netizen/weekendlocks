import { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');

  const sendMagicLink = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'weekendlocks://auth' }
    });
    if (error) Alert.alert('Login failed', error.message);
    else Alert.alert('Check your email for the magic link!');
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
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 20 }
});
