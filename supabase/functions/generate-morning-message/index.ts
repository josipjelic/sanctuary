/**
 * generate-morning-message edge function.
 * Fetches the authenticated user's OCEAN profile from `ocean_profiles` and
 * asks OpenRouter to generate a short, personalised morning motivational
 * message. Stateless — the edge function returns the message but does NOT
 * persist it; the client is responsible for caching to `morning_messages`.
 * ADR-003: OCEAN scores are never logged.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logAiError, logAiInfo, truncateForLog } from "../_shared/ai-log.ts";

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

interface OceanProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

function buildMorningMessagePrompt(profile: OceanProfile): string {
  // Translate numeric scores into natural-language descriptors for the model.
  // Scores above 0.65 → "high", below 0.35 → "low", otherwise "moderate".
  function level(v: number): string {
    if (v >= 0.65) return "high";
    if (v <= 0.35) return "low";
    return "moderate";
  }

  return `You are writing a warm, personalised morning message for someone based on their Big Five personality profile.

Personality profile (Big Five dimensions, each 0.0–1.0):
- Openness to experience: ${level(profile.openness)} (${profile.openness.toFixed(2)})
- Conscientiousness: ${level(profile.conscientiousness)} (${profile.conscientiousness.toFixed(2)})
- Extraversion: ${level(profile.extraversion)} (${profile.extraversion.toFixed(2)})
- Agreeableness: ${level(profile.agreeableness)} (${profile.agreeableness.toFixed(2)})
- Neuroticism (emotional sensitivity): ${level(profile.neuroticism)} (${profile.neuroticism.toFixed(2)})

Write a short morning message of 2–3 sentences. Guidelines:
- Speak directly to the person ("you", not "they")
- Reflect their actual personality — high openness might mean acknowledging their curiosity; high neuroticism might mean gentle grounding; low extraversion might mean honouring quiet time
- Tone: calm, warm, specific to this person — like a thoughtful friend who knows you well, not a life coach or algorithm
- Do NOT give generic advice ("have a great day", "stay positive")
- Do NOT mention scores, personality tests, or the Big Five
- Do NOT use clinical language
- Return only the message text — no greeting label, no title, no quotation marks`;
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

  // Accept (and ignore) an empty JSON body — client may send {} or nothing.
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      await req.json();
    }
  } catch {
    // Empty or missing body is fine; ignore parse errors.
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("ocean_profiles")
    .select(
      "openness, conscientiousness, extraversion, agreeableness, neuroticism",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "[generate-morning-message] ocean_profiles select error",
      profileError,
    );
    return jsonResponse({ error: "Failed to load profile" }, 500);
  }

  if (!profileRow) {
    return jsonResponse({ error: "no_profile" }, 404);
  }

  const profile = profileRow as OceanProfile;

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const model =
    Deno.env.get("OPENROUTER_OCEAN_MODEL") ??
    Deno.env.get("OPENROUTER_TOPIC_MODEL") ??
    "google/gemini-2.0-flash-001";

  const httpReferer = Deno.env.get("OPENROUTER_HTTP_REFERER");

  const prompt = buildMorningMessagePrompt(profile);

  const requestBody = {
    model,
    messages: [{ role: "user" as const, content: prompt }],
  };

  // ADR-003: OCEAN scores must not appear in logs.
  // Log only metadata about the request, not the prompt (which contains scores).
  logAiInfo({
    event: "ai.request.start",
    function: "generate-morning-message",
    phase: "morning-message",
    model,
    user_id: user.id,
    request_summary: {
      has_profile: true,
      prompt_chars: prompt.length,
    },
  });

  const orHeaders: Record<string, string> = {
    Authorization: `Bearer ${openrouterKey}`,
    "Content-Type": "application/json",
    "X-Title": "Sanctuary",
  };
  if (httpReferer) {
    orHeaders["HTTP-Referer"] = httpReferer;
  }

  let message: string;
  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: orHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!orRes.ok) {
      const errText = await orRes.text();
      logAiError({
        event: "ai.error",
        function: "generate-morning-message",
        phase: "morning-message",
        model,
        user_id: user.id,
        error: {
          message: "OpenRouter request failed",
          http_status: orRes.status,
          kind: "openrouter_http",
        },
        response_summary: {
          body_preview: truncateForLog(errText, 400),
        },
        openrouter_response: { http_status: orRes.status, body: errText },
      });
      return jsonResponse(
        {
          error: "generation_failed",
          message: "AI generation request failed",
        },
        502,
      );
    }

    const orData = (await orRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    message = orData.choices?.[0]?.message?.content?.trim() ?? "";

    if (!message) {
      logAiError({
        event: "ai.error",
        function: "generate-morning-message",
        phase: "morning-message",
        model,
        user_id: user.id,
        error: {
          message: "Model returned empty message",
          kind: "empty_response",
        },
      });
      return jsonResponse(
        {
          error: "generation_failed",
          message: "AI returned an empty message",
        },
        502,
      );
    }

    logAiInfo({
      event: "ai.response.complete",
      function: "generate-morning-message",
      phase: "morning-message",
      model,
      user_id: user.id,
      response_summary: {
        message_chars: message.length,
        message_preview: truncateForLog(message, 80),
      },
    });
  } catch (err) {
    logAiError({
      event: "ai.error",
      function: "generate-morning-message",
      phase: "morning-message",
      model,
      user_id: user.id,
      error: {
        message: err instanceof Error ? err.message : "OpenRouter fetch failed",
        kind: "openrouter_fetch",
      },
    });
    return jsonResponse(
      {
        error: "generation_failed",
        message: "AI generation request failed",
      },
      502,
    );
  }

  return jsonResponse({ message });
});
