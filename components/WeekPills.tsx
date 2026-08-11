// components/WeekPills.tsx
// Native-compatible week selector (a horizontal row of pressable pills).
// Used instead of a raw HTML <select> — which has no React Native native
// equivalent and would break on iOS/Android — anywhere a week needs picking.
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function WeekPills({
  count, selected, current, onSelect,
}: { count: number; selected: number; current?: number; onSelect: (w: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {Array.from({ length: count }, (_, i) => i + 1).map((w) => {
        const active = w === selected;
        return (
          <Pressable
            key={w}
            onPress={() => onSelect(w)}
            style={[styles.weekPill, active && styles.weekPillActive]}
          >
            <Text style={[styles.weekPillText, active && styles.weekPillTextActive]}>{w}</Text>
            {w === current && <View style={[styles.liveDot, active && styles.liveDotActive]} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  weekPill: {
    minWidth: 34, height: 34, paddingHorizontal: 10, borderRadius: 999,
    borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4,
  },
  weekPillActive: { backgroundColor: "#0B735F", borderColor: "#0B735F" },
  weekPillText: { fontSize: 13, fontWeight: "700", color: "#334155" },
  weekPillTextActive: { color: "white" },
  liveDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: "#0B735F" },
  liveDotActive: { backgroundColor: "white" },
});
