/**
 * Tag-thought edge function.
 * Use esm.sh + inline CORS — npm:/jsr: imports caused BOOT_ERROR (503) on hosted runtime.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Strip optional markdown code fences from the model's reply.
 * e.g. ```json\n["idea"]\n``` -> ["idea"]
 */
function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Normalize tags: lowercase, trim, deduplicate, cap at 4.
 */
function normalizeTags(raw: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.toLowerCase().trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
    if (result.length === 4) break;
  }
  return result;
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

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
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

  await supabase
    .from("thoughts")
    .update({ tagging_status: "pending" })
    .eq("id", thought_id);

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    await supabase
      .from("thoughts")
      .update({ tagging_status: "failed" })
      .eq("id", thought_id);
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const model =
    Deno.env.get("OPENROUTER_TAGGING_MODEL") ??
    "google/gemini-2.0-flash-001";

  const orHeaders: Record<string, string> = {
    Authorization: `Bearer ${openrouterKey}`,
    "Content-Type": "application/json",
    "X-Title": "Sanctuary",
  };
  const referer = Deno.env.get("OPENROUTER_HTTP_REFERER");
  if (referer) {
    orHeaders["HTTP-Referer"] = referer;
  }

  const prompt =
    `Return 1-4 lowercase tags for the following thought as a raw JSON array of strings.\n` +
    `Reply with ONLY the JSON array, no markdown, no explanation.\n` +
    `Examples: ["idea","work"], ["feeling","gratitude"], ["task","health"]\n\n` +
    `Thought: ${text.trim()}`;

  let orRes: Response;
  try {
    orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: orHeaders,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });
  } catch (err) {
    console.error("OpenRouter fetch error", err);
    await supabase
      .from("thoughts")
      .update({ tagging_status: "failed" })
      .eq("id", thought_id);
    return jsonResponse({ error: "Tagging failed" }, 502);
  }

  if (!orRes.ok) {
    const errText = await orRes.text();
    console.error("OpenRouter error", orRes.status, errText);
    await supabase
      .from("thoughts")
      .update({ tagging_status: "failed" })
      .eq("id", thought_id);
    return jsonResponse({ error: "Tagging failed" }, 502);
  }

  const orData = (await orRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = orData.choices?.[0]?.message?.content?.trim() ?? "";

  let tags: string[];
  try {
    const stripped = stripCodeFences(rawContent);
    const parsed = JSON.parse(stripped);
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not a JSON array");
    }
    tags = normalizeTags(parsed);
  } catch (err) {
    console.error("Tag parse error", err, "raw content:", rawContent);
    await supabase
      .from("thoughts")
      .update({ tagging_status: "failed" })
      .eq("id", thought_id);
    return jsonResponse({ error: "Tagging failed" }, 502);
  }

  const { error: updateError } = await supabase
    .from("thoughts")
    .update({
      tags,
      tagging_status: "complete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", thought_id);

  if (updateError) {
    console.error("DB update error", updateError);
    return jsonResponse({ error: "Failed to save tags" }, 500);
  }

  return jsonResponse({ thought_id, tags });
});
