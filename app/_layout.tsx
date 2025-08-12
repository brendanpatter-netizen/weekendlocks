// app/_layout.tsx
import { useEffect, useRef, useState } from "react";
import { View, Platform } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const showHeader = Platform.OS === "web";

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
    !!p && (p === "/" || p === "/index" || p.startsWith("/picks") || p.startsWith("/auth"));

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
    <View style={{ flex: 1 }}>
      {showHeader && <Header />}
      <Slot />
    </View>
  );
}
