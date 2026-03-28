#!/usr/bin/env node
/**
 * Writes EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY into .env
 * using `supabase projects api-keys` (requires `npx supabase login`).
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const refPath = path.join(root, "supabase", ".temp", "project-ref");
const envPath = path.join(root, ".env");

if (!fs.existsSync(envPath)) {
  console.error("Missing .env — copy .env.example to .env first.");
  process.exit(1);
}

if (!fs.existsSync(refPath)) {
  console.error(
    "Missing supabase/.temp/project-ref — run `npx supabase link --project-ref <ref>` or start Supabase locally once.",
  );
  process.exit(1);
}

const ref = fs.readFileSync(refPath, "utf8").trim();
let json;
try {
  json = execSync(
    `npx supabase@2.84.4 projects api-keys --project-ref ${JSON.stringify(ref)} -o json`,
    { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
} catch {
  console.error(
    "Supabase CLI failed. Run `npx supabase@2.84.4 login` and try again.",
  );
  process.exit(1);
}

let keys;
try {
  keys = JSON.parse(json);
} catch {
  console.error("Unexpected CLI output (not JSON).");
  process.exit(1);
}

const anon = keys.find((k) => k.name === "anon");
if (!anon?.api_key) {
  console.error("No anon key in API response.");
  process.exit(1);
}

let env = fs.readFileSync(envPath, "utf8");
env = env.replace(
  /^EXPO_PUBLIC_SUPABASE_URL=.*$/m,
  `EXPO_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co`,
);
env = env.replace(
  /^EXPO_PUBLIC_SUPABASE_ANON_KEY=.*$/m,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=${anon.api_key}`,
);
fs.writeFileSync(envPath, env);
console.log(
  "Updated .env: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY",
);
