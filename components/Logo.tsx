// components/Logo.tsx
// The WeekendLocks mark: a padlock with a football's laces standing in for
// the keyhole — the shackle and body are drawn in the exact same authored
// stroke as LockIcon/TrophyIcon/FlameIcon, so the brand mark reads as one
// family with every section icon in the app, not a separate solid-badge
// logo bolted on top of the drawn-icon world. See DESIGN.md's Section Icons
// entry.
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

export function LogoMark({ size = 24, color = "#B23A2E" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Shackle + body — identical paths to LockIcon */}
      <Path
        d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10"
        stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M4.5 10h15v10.5a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 4.5 20.5V10Z"
        stroke={color} strokeWidth={2.4} strokeLinejoin="round"
      />
      {/* Football-laces keyhole, in place of LockIcon's plain slit */}
      <Path
        d="M7.8 15.25c0-2.25 1.8-3.35 4.2-3.35s4.2 1.1 4.2 3.35-1.8 3.35-4.2 3.35-4.2-1.1-4.2-3.35Z"
        stroke={color} strokeWidth={1.4} strokeLinejoin="round"
      />
      <Path d="M12 12.3v5.9" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M10.6 13.6h2.8M10.3 15.25h3.4M10.6 16.9h2.8" stroke={color} strokeWidth={1.1} strokeLinecap="round" />
    </Svg>
  );
}

// Standalone "app icon" moment (login page) — a chalk-paper chip carrying
// the mark, matching every other card's paper-and-dashed-border language
// instead of a solid color-fill badge.
export function LogoBadge({ size = 40 }: { size?: number }) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size * 0.28 },
      ]}
    >
      <LogoMark size={size * 0.56} color="#B23A2E" />
    </View>
  );
}

// Nav-bar lockup: mark + "WeekendLocks" wordmark, both in the board's own
// chalk-white/marker-red pairing so it sits directly on the felt background
// like every other on-board headline (see DESIGN.md's Page Title tier).
export function BrandLockup({ size = 30 }: { size?: number }) {
  return (
    <View style={styles.lockup}>
      <LogoMark size={size * 1.2} color="#F5F3E7" />
      <Text style={[styles.lockupText, { fontSize: size * 0.62 }]}>
        Weekend<Text style={styles.lockupAccent}>Locks</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F3E7",
    borderWidth: 1.5,
    borderColor: "rgba(12,23,18,0.18)",
    borderStyle: "dashed",
  },
  lockup: { flexDirection: "row", alignItems: "center", gap: 8 },
  lockupText: { fontFamily: "PermanentMarker_400Regular", color: "#F5F3E7" },
  lockupAccent: { color: "#B23A2E" },
});
