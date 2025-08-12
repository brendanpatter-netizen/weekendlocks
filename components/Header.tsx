// components/Header.tsx
import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";

const colors = {
  primary: "#006241",
  secondary: "#FFD700",
  textOnPrimary: "#FFFFFF",
};

export default function Header() {
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user?.email ?? undefined);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? undefined);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isSignedIn = !!email;

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      if (typeof window !== "undefined") window.location.assign("/auth/login");
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.inner}>
        <View style={styles.left}>
          <Link href="/" asChild>
            <Pressable><Text style={styles.nav}>Home</Text></Pressable>
          </Link>
          <Link href="/picks/page" asChild>
            <Pressable><Text style={styles.nav}>Picks</Text></Pressable>
          </Link>
        </View>

        <Text style={styles.brand}>WEEKEND LOCKS</Text>

        <View style={styles.right}>
          {isSignedIn ? (
            <>
              {/* ✅ Clicking this now navigates to /account */}
              <Link href="/account" asChild>
                <Pressable><Text style={styles.nav}>Account</Text></Pressable>
              </Link>
              <Pressable onPress={signOut}>
                <Text style={styles.nav}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <Link href="/auth/login" asChild>
              <Pressable><Text style={styles.nav}>Account</Text></Pressable>
            </Link>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: colors.primary,
  },
  inner: {
    height: 64,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  left: { flexDirection: "row", gap: 16, minWidth: 120 },
  right: { flexDirection: "row", gap: 16, alignItems: "center" },
  brand: {
    color: colors.textOnPrimary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  nav: {
    color: colors.textOnPrimary,
    opacity: 0.95,
    fontSize: 16,
    fontWeight: "700",
  },
});
