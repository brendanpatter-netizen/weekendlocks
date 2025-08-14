// app/_layout.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Platform, Text, Pressable } from "react-native";
import { Slot, usePathname, useRouter, Link } from "expo-router";
import { supabase } from "@/lib/supabase";

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
            <Text style={{ color: "#006241", textDecorationLine: "underline" }}>
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

  // Hide header on auth routes to reduce UI/routing races
  const onAuthRoute = pathname?.startsWith("/auth");
  const showHeader = Platform.OS === "web" && !onAuthRoute;

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
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

  // Public routes (add /groups here)
  const isPublic = (p?: string) =>
    !!p &&
    (p === "/" ||
      p === "/index" ||
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
        {/* Simple web header with a Groups link */}
        {showHeader && (
          <View
            style={{
              backgroundColor: "#054b3b",
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <Link href="/" style={{ color: "white", fontWeight: "700" }}>
                Home
              </Link>
              <Link href="/picks/page" style={{ color: "white", fontWeight: "700" }}>
                Picks
              </Link>
              <Link href="/groups" style={{ color: "white", fontWeight: "700" }}>
                Groups
              </Link>
            </View>

            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <Link href="/account" style={{ color: "white", fontWeight: "700" }}>
                Account
              </Link>
              {hasSession ? (
                <Pressable onPress={signOut}>
                  <Text style={{ color: "white", fontWeight: "700" }}>Sign out</Text>
                </Pressable>
              ) : (
                <Link href="/auth/login" style={{ color: "white", fontWeight: "700" }}>
                  Sign in
                </Link>
              )}
            </View>
          </View>
        )}

        <Slot />
      </View>
    </ErrorBoundary>
  );
}
