// app/_layout.tsx
import { useEffect } from "react";
import { View, Platform } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const showHeader = Platform.OS === "web";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      handleRoute(!!data.session, pathname);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      handleRoute(!!s, pathname);
    });
    return () => sub.subscription.unsubscribe();
  }, [pathname]);

  function isPublicPath(p: string) {
    if (!p) return false;
    // Public routes: home + all picks pages
    return p === "/" || p === "/index" || p.startsWith("/picks");
  }

  function handleRoute(hasSession: boolean, currentPath: string) {
    const inAuth = currentPath?.startsWith("/auth");

    // If NOT signed in and NOT on auth AND NOT on a public path, send to login
    if (!hasSession && !inAuth && !isPublicPath(currentPath)) {
      router.replace({ pathname: "/auth/login" });
      return;
    }
    // If signed in: do nothing (let pages decide navigation)
  }

  return (
    <View style={{ flex: 1 }}>
      {showHeader && <Header />}
      <Slot />
    </View>
  );
}
