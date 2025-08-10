// lib/auth.ts
import { supabase } from "@/lib/supabase";

export async function hardSignOut() {
  try {
    await supabase.auth.signOut({ scope: "global" } as any); // web: all tabs
  } catch {}

  if (typeof window !== "undefined") {
    try {
      for (const k of Object.keys(window.localStorage)) {
        if (k.startsWith("sb-") || k.includes("supabase")) {
          window.localStorage.removeItem(k);
        }
      }
    } catch {}
  }
}
