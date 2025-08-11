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

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setHasSession(!!session);
      setReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isPublic = (p?: string) =>
    !!p && (p === "/" || p === "/index" || p.startsWith("/picks") || p.startsWith("/auth"));

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

