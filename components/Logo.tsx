// components/Logo.tsx
// The WeekendLocks mark: a padlock built from a football — the shackle is
// the loop, the body is the lock, and the keyhole is the ball itself (seam +
// laces included). Reads as "lock" at a glance, rewards a second look with
// the sport in it. See the design audit for the full rationale.
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Rect, Line, G } from "react-native-svg";
import { colors } from "@/lib/theme";

export function LogoMark({ size = 40, cutout = colors.brand }: { size?: number; cutout?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M32,44 V34 A18,18 0 0 1 68,34 V44" fill="none" stroke="#FFFFFF" strokeWidth={9} strokeLinecap="round" />
      <Rect x={19} y={41} width={62} height={46} rx={11} fill="#FFFFFF" />
      <G transform="rotate(-18 50 64)">
        <Path d="M50,44 A22,22 0 0 1 50,84 A22,22 0 0 1 50,44 Z" fill={cutout} />
        <Line x1={50} y1={49} x2={50} y2={79} stroke="#FFFFFF" strokeWidth={2.4} />
        <Line x1={45} y1={56} x2={55} y2={56} stroke="#FFFFFF" strokeWidth={2.2} />
        <Line x1={44} y1={64} x2={56} y2={64} stroke="#FFFFFF" strokeWidth={2.2} />
        <Line x1={45} y1={72} x2={55} y2={72} stroke="#FFFFFF" strokeWidth={2.2} />
      </G>
    </Svg>
  );
}

export function LogoBadge({ size = 40, background = colors.brand }: { size?: number; background?: string }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.26, backgroundColor: background }]}>
      <LogoMark size={size * 0.6} cutout={background} />
    </View>
  );
}

// Nav-bar lockup: mark + "WeekendLOCKS" wordmark, tuned for a dark green bar.
export function BrandLockup({ size = 26, textColor = "#EAF2EC", accentColor = colors.brassFill }: { size?: number; textColor?: string; accentColor?: string }) {
  return (
    <View style={styles.lockup}>
      <LogoBadge size={size} background={colors.brand} />
      <Text style={[styles.lockupText, { color: textColor }]}>
        Weekend<Text style={{ color: accentColor, fontWeight: "900" }}>Locks</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center" },
  lockup: { flexDirection: "row", alignItems: "center", gap: 8 },
  lockupText: { fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
});
