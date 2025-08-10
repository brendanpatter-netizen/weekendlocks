// components/Header.tsx
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Link } from "expo-router";

const colors = {
  primary: "#006241",   // dark green
  secondary: "#FFD700", // gold
  bg: "#F5F5F5",
  text: "#FFFFFF",
};

export default function Header() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {/* Left nav */}
        <View style={styles.left}>
          <Link href="/" asChild>
            <Pressable><Text style={styles.nav}>Home</Text></Pressable>
          </Link>

          {/* ⬇️ If your picks file is app/picks/index.tsx, change to href="/picks" */}
          <Link href={{ pathname: "/picks/page" }} asChild>
            <Pressable><Text style={styles.nav}>Picks</Text></Pressable>
          </Link>
        </View>

        {/* Center brand banner */}
        <Text style={styles.brand}>WEEKEND LOCKS</Text>

        {/* Right nav */}
        <View style={styles.right}>
          <Link href="/account" asChild>
            <Pressable><Text style={styles.nav}>Account</Text></Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: colors.primary,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
      },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      },
    }),
  },
  bar: {
    height: 64,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  left: { flexDirection: "row", gap: 16, minWidth: 120 },
  right: { flexDirection: "row", gap: 16, minWidth: 120, justifyContent: "flex-end" },
  brand: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "RobotoCondensed_700Bold",
  },
  nav: {
    color: colors.text,
    opacity: 0.95,
    fontSize: 16,
    fontFamily: "RobotoCondensed_700Bold",
  },
});
