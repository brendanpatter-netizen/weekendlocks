// app/_layout.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Platform, Text, Pressable } from "react-native";
import { Slot, usePathname, useRouter, Link } from "expo-router";
import { useFonts, RobotoCondensed_900Black } from "@expo-google-fonts/roboto-condensed";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { AlertHost } from "@/lib/alert";
import { BrandLockup } from "@/components/Logo";
import { colors } from "@/lib/theme";

/** Simple error boundary so we never see a blank page */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; err?: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, err: undefined };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, err };
  }
  componentDidCatch(err: any, info: any) {
    if (typeof window !== "undefined") console.error("App crashed:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            padding: 24,
            gap: 8,
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 6 }}>
            Something went wrong
          </Text>
          <Text selectable style={{ opacity: 0.75, marginBottom: 8 }}>
            {String(this.state.err?.message ?? this.state.err ?? "Unknown error")}
          </Text>
          <Pressable
            onPress={() =>
              (typeof window !== "undefined" ? window.location.reload() : null)
            }
          >
            <Text style={{ color: colors.brand, textDecorationLine: "underline" }}>
              Reload
            </Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children as any;
  }
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  // Loaded once, registered globally — used for big display headlines
  // (e.g. the group name) that want something bolder than the system font.
  // PermanentMarker is "The Whiteboard" world's display voice (group page
  // section headers) — a real sourced face, not the platform sans. Loaded
  // as a local asset (not the @expo-google-fonts npm package) because that
  // package's .ttf require() failed to resolve in Metro on this machine
  // even after a full cache clear, for reasons unrelated to this file.
  useFonts({
    RobotoCondensed_900Black,
    PermanentMarker_400Regular: require("../assets/fonts/PermanentMarker-Regular.ttf"),
  });

  // Hide header on auth routes to reduce UI/routing races
  const onAuthRoute = pathname?.startsWith("/auth");
  const showHeader = Platform.OS === "web" && !onAuthRoute;

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastRedirect = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setReady(true);
    });

    // Auth events
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      setHasSession(!!session);
      setReady(true);

      if (event === "SIGNED_IN" && session?.user) {
        const { user_metadata } = session.user;
        if (!user_metadata?.password_set && pathname !== "/account") {
          router.replace("/account");
          return;
        }
      }

      if (event === "SIGNED_OUT" && pathname !== "/auth/login") {
        router.replace("/auth/login");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Close the nav menu on every navigation, so it never lingers over a new page.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Public routes (add /groups here)
  const isPublic = (p?: string) =>
    !!p &&
    (p === "/" ||
      p === "/index" ||
      p.startsWith("/how-it-works") ||
      p.startsWith("/picks") ||
      p.startsWith("/groups") || // <-- NEW
      p.startsWith("/auth")); // login/reset/callback are all under /auth

  // Guard private routes
  useEffect(() => {
    if (!ready) return;
    if (!hasSession && !isPublic(pathname)) {
      const target = "/auth/login";
      if (lastRedirect.current !== target) {
        lastRedirect.current = target;
        router.replace({ pathname: target });
      }
      return;
    }
    lastRedirect.current = null;
  }, [ready, hasSession, pathname, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        {/* Web header: centered logo + a single hamburger menu covering all nav */}
        {showHeader && (
          <View
            style={{
              backgroundColor: colors.felt,
              paddingHorizontal: 14,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              position: "relative",
            }}
          >
            {/* Absolutely centered so the hamburger on the right doesn't push it
                off-center — box-none lets the wrapper itself pass touches through. */}
            <View
              style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
              pointerEvents="box-none"
            >
              <Link href="/" style={{ textDecorationLine: "none" }}>
                <BrandLockup size={32} />
              </Link>
            </View>

            <Pressable
              onPress={() => setMenuOpen((v) => !v)}
              style={{ padding: 6, zIndex: 1 }}
              accessibilityRole="button"
              accessibilityLabel={menuOpen ? "Close menu" : "Open menu"}
            >
              <Ionicons name={menuOpen ? "close" : "menu-outline"} size={26} color="#F5F3E7" />
            </Pressable>
          </View>
        )}

        {showHeader && menuOpen && (
          <>
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}
            />
            <View
              style={{
                position: "absolute", top: 60, right: 14, zIndex: 21, minWidth: 200,
                backgroundColor: "#F5F3E7", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.18)",
                borderStyle: "dashed", borderRadius: 10, paddingVertical: 6,
                shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
              }}
            >
              <Link href="/how-it-works" style={{ paddingVertical: 12, paddingHorizontal: 16, color: "#0C1712", fontWeight: "700", fontSize: 15 }}>
                How It Works
              </Link>
              <View style={{ height: 1, backgroundColor: "rgba(12,23,18,0.12)", marginHorizontal: 12 }} />
              <Link href="/groups" style={{ paddingVertical: 12, paddingHorizontal: 16, color: "#0C1712", fontWeight: "700", fontSize: 15 }}>
                Groups
              </Link>
              <View style={{ height: 1, backgroundColor: "rgba(12,23,18,0.12)", marginHorizontal: 12 }} />
              <Link href="/account" style={{ paddingVertical: 12, paddingHorizontal: 16, color: "#0C1712", fontWeight: "700", fontSize: 15 }}>
                Account
              </Link>
              <View style={{ height: 1, backgroundColor: "rgba(12,23,18,0.12)", marginHorizontal: 12 }} />
              {hasSession ? (
                <Pressable onPress={signOut} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                  <Text style={{ color: "#0C1712", fontWeight: "700", fontSize: 15 }}>Sign out</Text>
                </Pressable>
              ) : (
                <Link href="/auth/login" style={{ paddingVertical: 12, paddingHorizontal: 16, color: "#0C1712", fontWeight: "700", fontSize: 15 }}>
                  Sign in
                </Link>
              )}
            </View>
          </>
        )}

        <Slot />
        <AlertHost />
      </View>
    </ErrorBoundary>
  );
}
