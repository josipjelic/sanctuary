import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";

import { logger } from "@/lib/logger";

/** Use Expo's native fetch on iOS/Android (not the XHR polyfill) so HTTPS matches system/Safari behavior. */
const supabaseFetch: typeof fetch = (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (init == null) {
    return expoFetch(url);
  }
  const { body, signal, ...rest } = init;
  return expoFetch(url, {
    ...rest,
    body: body === null ? undefined : body,
    signal: signal === null ? undefined : signal,
  } as Parameters<typeof expoFetch>[1]);
};

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

export { supabaseUrl, supabaseAnonKey };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: supabaseFetch },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
