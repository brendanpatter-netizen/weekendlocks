// lib/alert.tsx
// React Native's Alert.alert() is a documented no-op on web (see
// react-native-web's Alert module — the whole method body is empty), so
// every confirmation/error dialog in this app was silently doing nothing on
// the deployed website. This is a drop-in replacement with the same
// (title, message?, buttons?) signature: native platforms delegate straight
// to the real Alert.alert, web renders an actual modal dialog.
import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, Alert as RNAlert, Platform } from "react-native";

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

type AlertState = { title: string; message?: string; buttons: AlertButton[] } | null;

let setHostState: ((s: AlertState) => void) | null = null;

export function alert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== "web") {
    RNAlert.alert(title, message, buttons as any);
    return;
  }
  const finalButtons = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  if (setHostState) {
    setHostState({ title, message, buttons: finalButtons });
  } else {
    // AlertHost isn't mounted (shouldn't normally happen) — fall back rather than losing the message.
    window.alert([title, message].filter(Boolean).join("\n\n"));
  }
}

// Mount once near the app root (see app/_layout.tsx) so alert() has somewhere to render into.
export function AlertHost() {
  const [state, setState] = useState<AlertState>(null);

  useEffect(() => {
    setHostState = setState;
    return () => {
      setHostState = null;
    };
  }, []);

  if (Platform.OS !== "web" || !state) return null;

  const close = (btn: AlertButton) => {
    setState(null);
    btn.onPress?.();
  };

  const cancelBtn = state.buttons.find((b) => b.style === "cancel") ?? state.buttons[0];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(cancelBtn)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{state.title}</Text>
          {!!state.message && <Text style={styles.message}>{state.message}</Text>}
          <View style={styles.buttonRow}>
            {state.buttons.map((b, i) => (
              <Pressable
                key={i}
                onPress={() => close(b)}
                style={[
                  styles.button,
                  b.style === "cancel" && styles.buttonCancel,
                  b.style === "destructive" && styles.buttonDestructive,
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    b.style === "cancel" && styles.buttonTextCancel,
                  ]}
                >
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "white", borderRadius: 16, padding: 20, gap: 4, maxWidth: 420, width: "100%" },
  title: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  message: { fontSize: 14, color: "#475569", marginTop: 4, lineHeight: 20 },
  buttonRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 18 },
  button: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#0B735F" },
  buttonCancel: { backgroundColor: "#F1F5F9" },
  buttonDestructive: { backgroundColor: "#DC2626" },
  buttonText: { color: "white", fontWeight: "700", fontSize: 14 },
  buttonTextCancel: { color: "#334155" },
});
