/**
 * generate-morning-message edge function.
 * Fetches the authenticated user's OCEAN profile and most recent daily
 * check-in, then asks OpenRouter to generate a personalised morning message.
 * Stateless — the edge function returns the message but does NOT persist it;
 * the client is responsible for caching to `morning_messages`.
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

function buildMorningMessagePrompt(
  profile: OceanProfile,
  recentCheckin: { mood: string | null; intention: string | null } | null,
): string {
  function level(v: number): string {
    if (v >= 0.65) return "high";
    if (v <= 0.35) return "low";
    return "moderate";
  }

  const oceanLines = [
    `- Openness to experience: ${level(profile.openness)} (${profile.openness.toFixed(2)})`,
    `- Conscientiousness: ${level(profile.conscientiousness)} (${profile.conscientiousness.toFixed(2)})`,
    `- Extraversion: ${level(profile.extraversion)} (${profile.extraversion.toFixed(2)})`,
    `- Agreeableness: ${level(profile.agreeableness)} (${profile.agreeableness.toFixed(2)})`,
    `- Neuroticism (emotional sensitivity): ${level(profile.neuroticism)} (${profile.neuroticism.toFixed(2)})`,
  ].join("\n");

  const checkinLines =
    recentCheckin &&
    (recentCheckin.mood?.trim() || recentCheckin.intention?.trim())
      ? [
          recentCheckin.mood?.trim()
            ? `- Mood: ${recentCheckin.mood.trim()}`
            : null,
          recentCheckin.intention?.trim()
            ? `- Intention: ${recentCheckin.intention.trim()}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  const parts: string[] = [
    `You are writing a warm, personalised morning message for someone based on their Big Five personality profile${checkinLines ? " and their recent check-in" : ""}.

Personality profile (Big Five dimensions, each 0.0–1.0):
${oceanLines}`,
  ];

  if (checkinLines) {
    parts.push(`Their most recent daily check-in:\n${checkinLines}`);
  }

  parts.push(`Write a morning message of 3–5 sentences (~60–90 words). Guidelines:
- Speak directly to the person ("you", not "they")
- Reflect their actual personality — high openness might mean acknowledging their curiosity; high neuroticism might mean gentle grounding; low extraversion might mean honouring quiet time
- If a recent check-in is available, let it shape the message's theme naturally — do not simply echo the words back
- Tone: calm, warm, specific to this person — like a thoughtful friend who knows you well, not a life coach or algorithm
- Do NOT give generic advice ("have a great day", "stay positive")
- Do NOT mention scores, personality tests, or the Big Five
- Do NOT use clinical language
- Return only the message text — no greeting label, no title, no quotation marks`);

  return parts.join("\n\n");
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

  // Fetch OCEAN profile and most recent check-in in parallel.
  // The check-in is non-fatal — message still generates without it.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [profileResult, checkinResult] = await Promise.all([
    supabase
      .from("ocean_profiles")
      .select(
        "openness, conscientiousness, extraversion, agreeableness, neuroticism",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("daily_checkins")
      .select("mood, intention")
      .eq("user_id", user.id)
      .gte("check_in_date", sevenDaysAgo)
      .order("check_in_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    console.error(
      "[generate-morning-message] ocean_profiles select error",
      profileResult.error,
    );
    return jsonResponse({ error: "Failed to load profile" }, 500);
  }

  if (!profileResult.data) {
    return jsonResponse({ error: "no_profile" }, 404);
  }

  const profile = profileResult.data as OceanProfile;

  if (checkinResult.error) {
    console.warn(
      "[generate-morning-message] daily_checkins fetch error",
      checkinResult.error,
    );
  }

  const recentCheckin =
    checkinResult.data !== null && checkinResult.data !== undefined
      ? (checkinResult.data as {
          mood: string | null;
          intention: string | null;
        })
      : null;

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const model =
    Deno.env.get("OPENROUTER_OCEAN_MODEL") ??
    Deno.env.get("OPENROUTER_TOPIC_MODEL") ??
    "google/gemini-2.5-flash-lite";

  const httpReferer = Deno.env.get("OPENROUTER_HTTP_REFERER");

  const prompt = buildMorningMessagePrompt(profile, recentCheckin);

  const requestBody = {
    model,
    messages: [{ role: "user" as const, content: prompt }],
  };

  // ADR-003: OCEAN scores must not appear in logs.
  logAiInfo({
    event: "ai.request.start",
    function: "generate-morning-message",
    phase: "morning-message",
    model,
    user_id: user.id,
    request_summary: {
      has_profile: true,
      has_checkin: recentCheckin !== null,
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
