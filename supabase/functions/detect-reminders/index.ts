/**
 * Detect-reminders edge function (standalone endpoint).
 * Mirrors the assign-topics/index.ts pattern.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { detectRemindersForThought } from "../_shared/detect-reminders.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const { thought_id, text, current_iso_timestamp, iana_timezone } = body as Record<
    string,
    unknown
  >;

  if (!thought_id || typeof thought_id !== "string" || !thought_id.trim()) {
    return jsonResponse({ error: "thought_id required" }, 400);
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    return jsonResponse({ error: "text required" }, 400);
  }

  // current_iso_timestamp is optional — fall back to server clock if not provided
  const currentIsoTimestamp =
    typeof current_iso_timestamp === "string" && current_iso_timestamp.trim()
      ? current_iso_timestamp.trim()
      : new Date().toISOString();

  const ianaTimezone =
    typeof iana_timezone === "string" && iana_timezone.trim()
      ? iana_timezone.trim()
      : undefined;

  const { data: thought, error: fetchError } = await supabase
    .from("thoughts")
    .select("id, user_id")
    .eq("id", thought_id)
    .single();

  if (fetchError || !thought || thought.user_id !== user.id) {
    return jsonResponse({ error: "Thought not found" }, 404);
  }

  const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openRouterApiKey) {
    await supabase
      .from("thoughts")
      .update({ reminder_detection_status: "failed" })
      .eq("id", thought_id);
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  await detectRemindersForThought({
    userId: user.id,
    thoughtId: thought_id,
    text: text.trim(),
    currentIsoTimestamp,
    ianaTimezone,
    supabaseClient: supabase,
    openRouterApiKey,
    callerFunction: "detect-reminders",
  });

  // Re-read the reminders table to return the count of inserted rows
  const { data: reminders, error: remindersErr } = await supabase
    .from("reminders")
    .select("id")
    .eq("thought_id", thought_id)
    .eq("user_id", user.id)
    .eq("status", "inactive");

  if (remindersErr) {
    // Detection may have completed fine — return partial success
    return jsonResponse({ thought_id, reminder_count: 0 });
  }

  return jsonResponse({
    thought_id,
    reminder_count: (reminders ?? []).length,
  });
});
