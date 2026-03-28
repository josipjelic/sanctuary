/**
 * Assign-topics edge function (text capture path).
 * Shared logic in ../_shared/assign-topics.ts
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { assignTopicsToThought } from "../_shared/assign-topics.ts";

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

  const { thought_id, text } = body as Record<string, unknown>;

  if (!thought_id || typeof thought_id !== "string" || !thought_id.trim()) {
    return jsonResponse({ error: "thought_id required" }, 400);
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    return jsonResponse({ error: "text required" }, 400);
  }

  const { data: thought, error: fetchError } = await supabase
    .from("thoughts")
    .select("id, user_id")
    .eq("id", thought_id)
    .single();

  if (fetchError || !thought || thought.user_id !== user.id) {
    return jsonResponse({ error: "Thought not found" }, 404);
  }

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    await supabase
      .from("thoughts")
      .update({ tagging_status: "failed" })
      .eq("id", thought_id);
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const model =
    Deno.env.get("OPENROUTER_TOPIC_MODEL") ??
    Deno.env.get("OPENROUTER_TAGGING_MODEL") ??
    "google/gemini-2.0-flash-001";

  const referer = Deno.env.get("OPENROUTER_HTTP_REFERER");

  const result = await assignTopicsToThought({
    supabase,
    userId: user.id,
    thoughtId: thought_id,
    text: text.trim(),
    openrouterKey,
    model,
    httpReferer: referer ?? undefined,
  });

  if ("error" in result) {
    return jsonResponse(result, 502);
  }

  return jsonResponse(result);
});
