// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Use env vars in both Expo + Vercel web builds
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://atgkuhppxugkvehmdhhz.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2t1aHBweHVna3ZlaG1kaGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MzI4NzEsImV4cCI6MjA2OTQwODg3MX0.lZ1icv_D8Ahglst07HWCqep_HpTqSXekxFyMsyhJNZs";

// Explicit storage control on web so we can reliably wipe it in hardSignOut()
const isBrowser = typeof window !== "undefined";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isBrowser ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // enables magic-link/callback handling on web
  },
});
