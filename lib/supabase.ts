// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Resolve env (Expo + Vercel)
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (Constants.expoConfig?.extra as any)?.supabaseUrl;

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (Constants.expoConfig?.extra as any)?.supabaseAnonKey;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase env vars are missing");
}

// Node/SSR build?
const isSSR = typeof window === "undefined";

// Storage selection:
// - SSR build: no-op adapter (don’t touch window)
// - Web runtime: localStorage
// - Native runtime: AsyncStorage
const serverStorage = {
  getItem: async (_k: string) => null as string | null,
  setItem: async (_k: string, _v: string) => {},
  removeItem: async (_k: string) => {},
};

const storage: any = isSSR
  ? serverStorage
  : Platform.OS === "web"
  ? window.localStorage
  : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    // Avoid session work during SSR build
    persistSession: !isSSR,
    autoRefreshToken: !isSSR,
    detectSessionInUrl: !isSSR && Platform.OS === "web",
  },
});
