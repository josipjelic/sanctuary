const fs = require("node:fs");
const path = require("node:path");
const dotenv = require(
  require.resolve("dotenv", {
    paths: [require.resolve("expo/package.json")],
  }),
);

/**
 * Values from `.env` for EXPO_PUBLIC_* keys. Reading the file here lets the
 * project file win over variables already present in `process.env`. Expo's
 * default loader (@expo/env) never overwrites existing env vars, which often
 * breaks local dev when the shell or IDE exports stale EXPO_PUBLIC_* values.
 */
function readExpoPublicSupabaseFromEnvFile(projectRoot) {
  const envPath = path.join(projectRoot, ".env");
  let parsed = {};
  try {
    parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  } catch {
    // Missing or unreadable .env (e.g. EAS) — use process.env only.
  }
  return {
    supabaseUrl: parsed.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

module.exports = ({ config }) => {
  const file = readExpoPublicSupabaseFromEnvFile(__dirname);
  const supabaseUrl = file.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    file.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  return {
    ...config,
    extra: {
      ...config.extra,
      supabaseUrl,
      supabaseAnonKey,
    },
  };
};
