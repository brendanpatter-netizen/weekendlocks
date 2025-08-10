import { View, Text, StyleSheet, Pressable } from "react-native";
import { Link } from "expo-router";
import {
  useFonts,
  RobotoCondensed_400Regular,
  RobotoCondensed_700Bold,
} from "@expo-google-fonts/roboto-condensed";

export default function Home() {
  const [fontsLoaded] = useFonts({
    RobotoCondensed_400Regular,
    RobotoCondensed_700Bold,
  });
  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WEEKEND LOCKS</Text>
      <Text style={styles.subtitle}>
        Social picks • Leaderboards • Bragging rights
      </Text>

      {/* Get started → auth */}
      <Link href="/auth/login" asChild>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Get started</Text>
        </Pressable>
      </Link>

      {/* Picks → prefer /picks (folder index). If TS still complains, object-form href helps. */}
      <Link href={{ pathname: "/picks/page" }} asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Picks</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const colors = {
  primary: "#006241",   // dark green
  secondary: "#FFD700", // gold
  bg: "#F5F5F5",        // light gray
  text: "#222",
  subtext: "#555",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontFamily: "RobotoCondensed_700Bold",
    textTransform: "uppercase",
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "RobotoCondensed_400Regular",
    color: colors.subtext,
    marginBottom: 30,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 10,
    minWidth: 180,
    alignItems: "center",
    elevation: 2,
  },
  primaryButtonText: {
    color: "#fff",
    fontFamily: "RobotoCondensed_700Bold",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 10,
    minWidth: 180,
    alignItems: "center",
    elevation: 1,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontFamily: "RobotoCondensed_700Bold",
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
