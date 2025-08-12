// app/_layout.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Platform, Text, Pressable } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

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
    // helpful in prod debugging
    if (typeof window !== "undefined") console.error("App crashed:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, padding: 24, gap: 8, alignItems: "flex-start", justifyContent: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Something went wrong</Text>
          <Text selectable style={{ opacity: 0.75, marginBottom: 8 }}>
            {String(this.state.err?.message ?? this.state.err ?? "Unknown error")}
          </Text>
          <Pressable onPress={() => (typeof window !== "undefined" ? window.location.reload() : null)}>
            <Text style={{ color: "#006241", textDecorationLine: "underline" }}>Reload</Text>
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

      // First-time nudge to /account (only right when signing in)
      if (event === "SIGNED_IN" && session?.user) {
        const { user_metadata } = session.user;
        if (!user_metadata?.password_set && pathname !== "/account") {
          router.replace("/account");
          return;
        }
      }

      // Always send signed-out users to login
      if (event === "SIGNED_OUT" && pathname !== "/auth/login") {
        router.replace("/auth/login");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Public routes
  const isPublic = (p?: string) =>
    !!p &&
    (p === "/" ||
      p === "/index" ||
      p.startsWith("/picks") ||
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

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        {showHeader && <Header />}
        <Slot />
      </View>
    </ErrorBoundary>
  );
}
