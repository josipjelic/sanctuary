#!/usr/bin/env node
/**
 * Uses Supabase CLI (same as `pnpm run db:push`) to print values useful for
 * GitHub Actions secrets: project ref from `projects list` / linked project.
 *
 * Prerequisites: `npx supabase@2.84.4 login` (or `SUPABASE_ACCESS_TOKEN` in env).
 *
 * Does not print database passwords or API keys. SUPABASE_ACCESS_TOKEN for CI
 * is the dashboard personal access token (same string you paste for `supabase login`).
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const supabaseBin = "npx supabase@2.84.4";
const refPath = path.join(root, "supabase", ".temp", "project-ref");

function readLinkedRef() {
  try {
    return fs.readFileSync(refPath, "utf8").trim();
  } catch {
    return null;
  }
}

function tryReadFallbackAccessTokenFile() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;
  const p = path.join(home, ".supabase", "access-token");
  try {
    const t = fs.readFileSync(p, "utf8").trim();
    return t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

let projects;
try {
  const out = execSync(`${supabaseBin} projects list -o json`, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  projects = JSON.parse(out);
} catch (err) {
  const stderr = err.stderr?.toString()?.trim();
  const stdout = err.stdout?.toString()?.trim();
  if (stderr) console.error(stderr);
  else if (stdout) console.error(stdout);
  else console.error(err.message || String(err));
  console.error(
    "\nFix: run `npx supabase@2.84.4 login` or export SUPABASE_ACCESS_TOKEN (see https://supabase.com/dashboard/account/tokens ).",
  );
  process.exit(1);
}

if (!Array.isArray(projects) || projects.length === 0) {
  console.log("No Supabase projects returned for this account.");
  process.exit(0);
}

const linkedRef = readLinkedRef();

console.log(
  "Supabase projects (Reference ID = SUPABASE_PROJECT_ID for GitHub):\n",
);
for (const p of projects) {
  const id = p.id ?? p.ref ?? p.project_id;
  if (!id) continue;
  const name = p.name ?? "";
  const suffix = linkedRef && id === linkedRef ? "  ← linked in this repo" : "";
  console.log(`  ${id}  ${name}${suffix}`);
}

const suggestedRef =
  linkedRef &&
  projects.some((p) => (p.id ?? p.ref ?? p.project_id) === linkedRef)
    ? linkedRef
    : (projects[0].id ?? projects[0].ref ?? projects[0].project_id);

console.log("\n--- GitHub Actions (repository secrets)\n");
console.log("1) SUPABASE_PROJECT_ID");
console.log(`   gh secret set SUPABASE_PROJECT_ID --body "${suggestedRef}"\n`);

console.log("2) SUPABASE_ACCESS_TOKEN");
console.log("   Dashboard: https://supabase.com/dashboard/account/tokens");
if (process.env.SUPABASE_ACCESS_TOKEN) {
  console.log(
    "   Your shell already has SUPABASE_ACCESS_TOKEN — pipe it (avoid shell history):",
  );
  console.log(
    '   printf %s "$SUPABASE_ACCESS_TOKEN" | gh secret set SUPABASE_ACCESS_TOKEN',
  );
} else {
  const fileTok = tryReadFallbackAccessTokenFile();
  if (fileTok) {
    console.log(
      "   Found token file ~/.supabase/access-token (fallback storage after login).",
    );
    console.log(
      "   gh secret set SUPABASE_ACCESS_TOKEN < ~/.supabase/access-token",
    );
  } else {
    console.log(
      "   After `supabase login`, tokens are often in the OS keychain only — create a PAT on the dashboard and:",
    );
    console.log(
      '   gh secret set SUPABASE_ACCESS_TOKEN --body "<paste-token>"',
    );
  }
}

console.log("\n3) SUPABASE_DB_PASSWORD");
console.log(
  "   Not available from the CLI or Management API. Dashboard → Settings → Database → Database password",
);
console.log("   (use reset if you do not have it). Then:");
console.log('   gh secret set SUPABASE_DB_PASSWORD --body "<password>"');
