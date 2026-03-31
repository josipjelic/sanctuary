import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

import { logger } from "@/lib/logger";

type SupabaseExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function supabaseFromAppConfig(): {
  url: string | undefined;
  anonKey: string | undefined;
} {
  const extra = Constants.expoConfig?.extra as SupabaseExtra | undefined;
  return {
    url: extra?.supabaseUrl,
    anonKey: extra?.supabaseAnonKey,
  };
}

/** Trim and strip a single pair of surrounding quotes (common .env copy-paste mistakes). */
function normalizeExpoEnv(value: string | undefined): string {
  if (!value) return "";
  let v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

const fromConfig = supabaseFromAppConfig();
const supabaseUrl = normalizeExpoEnv(
  fromConfig.url ?? process.env.EXPO_PUBLIC_SUPABASE_URL,
);
const supabaseAnonKey = normalizeExpoEnv(
  fromConfig.anonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

if (!supabaseUrl || !supabaseAnonKey) {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("EXPO_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  throw new Error(
    `Missing Supabase environment variables: ${missing.join(", ")}. Copy .env.example to .env and set non-empty values (Supabase Dashboard → Project Settings → API). Restart Expo after changing .env.`,
  );
}

try {
  const u = new URL(supabaseUrl);
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("not http(s)");
  }
} catch {
  throw new Error(
    `Invalid EXPO_PUBLIC_SUPABASE_URL. Expected a full URL (e.g. https://your-project.supabase.co), got: ${supabaseUrl.slice(0, 80)}${supabaseUrl.length > 80 ? "…" : ""}`,
  );
}

logger.debug("Supabase client URL", {
  url: supabaseUrl,
  fromAppConfigExtra: Boolean(fromConfig.url),
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
