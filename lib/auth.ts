import { supabase } from "@/lib/supabase";

export async function hardSignOut() {
  try {
    await supabase.auth.signOut({ scope: "global" } as any);
  } catch {}

  if (typeof window !== "undefined") {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sb-") || k.includes("supabase")) {
        localStorage.removeItem(k);
      }
    }
  }
}
