import { Stack, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors as theme } from "@/lib/theme";
import LockIcon from "@/components/LockIcon";
import TapeCorner from "@/components/TapeCorner";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={styles.pageOuter}>
        <View style={styles.card}>
          <TapeCorner />
          <LockIcon size={28} color="#B23A2E" />
          <Text style={styles.title}>This lock doesn't exist</Text>
          <Text style={styles.body}>The page you're looking for isn't here — it might have moved, or the link was off.</Text>
          <Pressable style={styles.button} onPress={() => router.replace("/")}>
            <Text style={styles.buttonText}>Back to WeekendLocks</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  pageOuter: { flex: 1, backgroundColor: theme.felt, alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    position: "relative", alignItems: "center", gap: 10, maxWidth: 340,
    backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)",
    borderStyle: "dashed", borderRadius: 14, padding: 28,
  },
  title: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 22, color: "#B23A2E", textAlign: "center" },
  body: { fontSize: 14, color: "#45564C", textAlign: "center", fontWeight: "600", lineHeight: 20 },
  button: {
    marginTop: 6, backgroundColor: theme.brand, borderRadius: 999,
    paddingHorizontal: 22, paddingVertical: 12,
  },
  buttonText: { color: "white", fontWeight: "700", fontSize: 14 },
});
