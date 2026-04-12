/**
 * journal-next-question edge function.
 *
 * Stateless single-shot per turn (ADR-006 Decision 1): client sends full turn
 * history and the server returns the next question or { done: true }.
 *
 * Turn 0: returns a context-aware opening question via LLM when any user
 * context is available (user_state, today's check-in, or OCEAN profile).
 * Falls back to JOURNAL_OPENING_QUESTION_V1 instantly when no context exists.
 * Turns 1–2: calls OpenRouter with prior Q&A + user_state + check-in + OCEAN.
 * turns.length >= 3: returns { done: true } unconditionally (server-side cap).
 *
 * Does NOT write to journal_entries — the mobile client owns incremental
 * persistence (ADR-006 Decision 4).
 *
 * Logging: ADR-003, phase "journal_question". Raw answer text is never logged;
 * only answer_char_count per turn. OCEAN scores are never logged.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logAiError, logAiInfo, truncateForLog } from "../_shared/ai-log.ts";

const JOURNAL_OPENING_QUESTION_V1 =
  "Take a moment to settle in. What's on your mind today — something that happened, a feeling, or just a thought that's been with you?";

const MAX_TURNS = 3;

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

interface Turn {
  turn_index: number;
  question: string;
  answer: string;
}

interface OceanProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface CheckinContext {
  mood: string | null;
  intention: string | null;
}

function isTurn(v: unknown): v is Turn {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.turn_index === "number" &&
    typeof t.question === "string" &&
    t.question.trim().length > 0 &&
    typeof t.answer === "string"
  );
}

function formatTurnsForPrompt(turns: Turn[]): string {
  return turns
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
    .join("\n\n");
}

function oceanLevel(v: number): string {
  if (v >= 0.65) return "high";
  if (v <= 0.35) return "low";
  return "moderate";
}

function buildOceanBlock(profile: OceanProfile): string {
  const hints: string[] = [];
  if (profile.neuroticism >= 0.65) hints.push("use gentler framing");
  if (profile.openness >= 0.65) hints.push("more exploratory questions welcome");
  if (profile.extraversion <= 0.35) hints.push("honour inward, quiet reflection");

  const lines = [
    `- Openness: ${oceanLevel(profile.openness)} (${profile.openness.toFixed(2)})`,
    `- Conscientiousness: ${oceanLevel(profile.conscientiousness)} (${profile.conscientiousness.toFixed(2)})`,
    `- Extraversion: ${oceanLevel(profile.extraversion)} (${profile.extraversion.toFixed(2)})`,
    `- Agreeableness: ${oceanLevel(profile.agreeableness)} (${profile.agreeableness.toFixed(2)})`,
    `- Neuroticism: ${oceanLevel(profile.neuroticism)} (${profile.neuroticism.toFixed(2)})`,
  ];

  if (hints.length > 0) {
    lines.push(`Guidance: ${hints.join("; ")}.`);
  }

  return lines.join("\n");
}

function buildSystemPrompt(
  userStateContent: string | null,
  checkin: CheckinContext | null,
  ocean: OceanProfile | null,
): string {
  const contextBlock = userStateContent?.trim()
    ? userStateContent.trim()
    : "(No prior profile — this is a new user or their first session.)";

  const checkinBlock =
    checkin && (checkin.mood?.trim() || checkin.intention?.trim())
      ? [
          "Today's check-in:",
          checkin.mood?.trim() ? `- Mood: ${checkin.mood.trim()}` : null,
          checkin.intention?.trim()
            ? `- Intention: ${checkin.intention.trim()}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  const oceanBlock = ocean ? buildOceanBlock(ocean) : null;

  const parts = [
    `You are a compassionate journaling guide for the Sanctuary app. Your role is to ask thoughtful follow-up questions that help the user reflect on their day.

Rules:
- NEVER assume anything about the user's life situation (no mentions of "your job", "your partner", "your kids", "your work" etc.) UNLESS the user has explicitly mentioned these in their answers
- Base your question on: (a) what the user just shared, and (b) their current context below
- If the user's context mentions unresolved struggles or ongoing challenges, gently check in about them when it feels natural — not forced
- Aim to cover both external events (things that happened) and internal experience (feelings, thoughts, reactions)
- Keep questions short, warm, and open-ended (max 20 words)
- If the user has shared enough meaningful reflection across all turns, respond with {"done": true} instead of a question
- Return ONLY valid JSON: {"question": "..."} or {"done": true}`,
  ];

  if (checkinBlock) {
    parts.push(checkinBlock);
  }

  if (oceanBlock) {
    parts.push(`User's personality (OCEAN — use to tune tone and depth, never mention directly):\n${oceanBlock}`);
  }

  parts.push(`User's current context (may be empty for new users):\n${contextBlock}`);

  return parts.join("\n\n");
}

function buildOpeningSystemPrompt(
  userStateContent: string | null,
  checkin: CheckinContext | null,
  ocean: OceanProfile | null,
): string {
  const contextBlock = userStateContent?.trim()
    ? userStateContent.trim()
    : "(No prior profile — this is a new user or their first session.)";

  const checkinBlock =
    checkin && (checkin.mood?.trim() || checkin.intention?.trim())
      ? [
          "Today's check-in:",
          checkin.mood?.trim() ? `- Mood: ${checkin.mood.trim()}` : null,
          checkin.intention?.trim()
            ? `- Intention: ${checkin.intention.trim()}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  const oceanBlock = ocean ? buildOceanBlock(ocean) : null;

  const parts = [
    `You are a compassionate journaling guide for the Sanctuary app. Your role is to write a warm, personalised opening question that invites the user to begin their daily reflection.

Rules:
- Write a single open-ended question (max 25 words) that feels personal and specific to this user — NOT generic
- If today's check-in is available, acknowledge their current mood or intention naturally within the question (without quoting it back verbatim)
- If a prior journal profile is available, let it subtly inform the question's theme or framing
- Use OCEAN personality scores only to tune tone (e.g. gentler for high neuroticism, more exploratory for high openness) — never mention them
- Speak directly and warmly — like a thoughtful friend, not a therapist
- Do NOT start with "What's on your mind" — be creative
- Return ONLY valid JSON: {"question": "..."}`,
  ];

  if (checkinBlock) {
    parts.push(checkinBlock);
  }

  if (oceanBlock) {
    parts.push(`User's personality (OCEAN — use to tune tone and depth, never mention directly):\n${oceanBlock}`);
  }

  parts.push(`User's journal profile (may be empty for new users):\n${contextBlock}`);

  return parts.join("\n\n");
}

function buildUserMessage(turns: Turn[], nextTurnIndex: number): string {
  const formatted = formatTurnsForPrompt(turns);
  return `The user has answered ${turns.length} question(s) so far. Here is the conversation:

${formatted}

This is question ${nextTurnIndex + 1} of a maximum of 3. Generate the next question, or signal done if the user has reflected sufficiently.`;
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function fetchCheckinContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<CheckinContext | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("daily_checkins")
      .select("mood, intention")
      .eq("user_id", userId)
      .eq("check_in_date", today)
      .maybeSingle();

    if (error) {
      console.warn("[journal-next-question] check-in fetch error", error);
      return null;
    }

    if (!data) return null;

    const row = data as { mood?: string | null; intention?: string | null };
    return {
      mood: row.mood ?? null,
      intention: row.intention ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchOceanProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<OceanProfile | null> {
  try {
    const { data, error } = await supabase
      .from("ocean_profiles")
      .select(
        "openness, conscientiousness, extraversion, agreeableness, neuroticism",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[journal-next-question] ocean_profiles fetch error", error);
      return null;
    }

    if (!data) return null;

    return data as OceanProfile;
  } catch {
    return null;
  }
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

  const { session_id, turns: rawTurns } = body as Record<string, unknown>;

  if (!session_id || typeof session_id !== "string" || !session_id.trim()) {
    return jsonResponse({ error: "session_id required" }, 400);
  }

  if (!Array.isArray(rawTurns)) {
    return jsonResponse({ error: "turns must be an array" }, 400);
  }

  if (!rawTurns.every(isTurn)) {
    return jsonResponse(
      {
        error:
          "Each turn must have turn_index (number), question (string), and answer (string)",
      },
      400,
    );
  }

  const turns = rawTurns as Turn[];
  const currentTurnIndex = turns.length;
  const sessionId = session_id.trim();

  // Verify the session belongs to the authenticated user (RLS + explicit user_id check = IDOR defence)
  const { data: session, error: sessionError } = await supabase
    .from("journal_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sessionError) {
    console.error("[journal-next-question] session fetch error", sessionError);
    return jsonResponse({ error: "Server error" }, 500);
  }

  if (!session) {
    return jsonResponse({ error: "Session not found" }, 403);
  }

  // Server-side 3-turn cap (ADR-006 Decision 1 — authoritative enforcement)
  if (currentTurnIndex >= MAX_TURNS) {
    return jsonResponse({ done: true });
  }

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const model =
    Deno.env.get("OPENROUTER_JOURNAL_MODEL") ??
    Deno.env.get("OPENROUTER_TOPIC_MODEL") ??
    "google/gemini-2.0-flash-001";

  // Fetch all context in parallel — all non-fatal
  const [userStateRow, checkinContext, oceanProfile] = await Promise.all([
    supabase
      .from("user_state")
      .select("content")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("[journal-next-question] user_state fetch error", error);
        }
        return (data as { content?: string | null } | null)?.content ?? null;
      }),
    fetchCheckinContext(supabase, user.id),
    fetchOceanProfile(supabase, user.id),
  ]);

  const userStateContent = userStateRow;

  // Opening question (turn 0)
  if (currentTurnIndex === 0) {
    const hasContext =
      !!userStateContent?.trim() ||
      !!checkinContext?.mood?.trim() ||
      !!checkinContext?.intention?.trim() ||
      !!oceanProfile;

    // Fast path: no context at all → return constant instantly (ADR-006 Decision 3)
    if (!hasContext) {
      return jsonResponse({
        question: JOURNAL_OPENING_QUESTION_V1,
        turn_index: 0,
      });
    }

    // Context path: personalised opening via LLM
    const systemPrompt = buildOpeningSystemPrompt(
      userStateContent,
      checkinContext,
      oceanProfile,
    );

    const requestSummary = {
      session_id: sessionId,
      turn_index: 0,
      has_user_state: !!userStateContent,
      has_checkin: !!checkinContext,
      has_ocean: !!oceanProfile,
      prompt_chars: systemPrompt.length,
    };

    logAiInfo({
      event: "ai.request.start",
      function: "journal-next-question",
      phase: "journal_question",
      model,
      user_id: user.id,
      request_summary: requestSummary,
    });

    const httpReferer = Deno.env.get("OPENROUTER_HTTP_REFERER");
    const orHeaders: Record<string, string> = {
      Authorization: `Bearer ${openrouterKey}`,
      "Content-Type": "application/json",
      "X-Title": "Sanctuary",
    };
    if (httpReferer) {
      orHeaders["HTTP-Referer"] = httpReferer;
    }

    const startMs = Date.now();
    try {
      const orRes = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: orHeaders,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system" as const, content: systemPrompt },
              {
                role: "user" as const,
                content:
                  "Generate the personalised opening question for today's journal session.",
              },
            ],
          }),
        },
      );

      const latencyMs = Date.now() - startMs;

      if (!orRes.ok) {
        const errText = await orRes.text();
        logAiError({
          event: "ai.error",
          function: "journal-next-question",
          phase: "journal_question",
          model,
          user_id: user.id,
          error: {
            message: "OpenRouter request failed (turn 0)",
            http_status: orRes.status,
            kind: "openrouter_http",
          },
          request_summary: { ...requestSummary, latency_ms: latencyMs },
          response_summary: { body_preview: truncateForLog(errText, 400) },
          openrouter_response: { http_status: orRes.status, body: errText },
        });
        // Fallback to constant on error
        return jsonResponse({
          question: JOURNAL_OPENING_QUESTION_V1,
          turn_index: 0,
        });
      }

      const orData = (await orRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent =
        orData.choices?.[0]?.message?.content?.trim() ?? "";

      logAiInfo({
        event: "ai.response.complete",
        function: "journal-next-question",
        phase: "journal_question",
        model,
        user_id: user.id,
        request_summary: { ...requestSummary, latency_ms: latencyMs },
        response_summary: {
          content_chars: rawContent.length,
          content_preview: truncateForLog(rawContent, 200),
        },
      });

      let parsed: { question?: unknown };
      try {
        parsed = JSON.parse(stripCodeFences(rawContent)) as {
          question?: unknown;
        };
      } catch {
        // Fallback to constant on parse error
        return jsonResponse({
          question: JOURNAL_OPENING_QUESTION_V1,
          turn_index: 0,
        });
      }

      if (typeof parsed.question === "string" && parsed.question.trim()) {
        return jsonResponse({
          question: parsed.question.trim(),
          turn_index: 0,
        });
      }

      // Fallback to constant if response shape unexpected
      return jsonResponse({
        question: JOURNAL_OPENING_QUESTION_V1,
        turn_index: 0,
      });
    } catch {
      // Fallback to constant on network error
      return jsonResponse({
        question: JOURNAL_OPENING_QUESTION_V1,
        turn_index: 0,
      });
    }
  }

  // Follow-up question (turn 1 or 2): call OpenRouter with full context
  const systemPrompt = buildSystemPrompt(
    userStateContent,
    checkinContext,
    oceanProfile,
  );
  const userMessage = buildUserMessage(turns, currentTurnIndex);

  const requestBody = {
    model,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ],
  };

  // ADR-003: never log raw answer text or OCEAN scores — only char counts per turn
  const requestSummary = {
    session_id: sessionId,
    turn_index: currentTurnIndex,
    turn_count: turns.length,
    has_user_state: userStateContent !== null,
    has_checkin: checkinContext !== null,
    has_ocean: oceanProfile !== null,
    answer_char_counts: turns.map((t) => t.answer.length),
    prompt_chars: systemPrompt.length + userMessage.length,
  };

  logAiInfo({
    event: "ai.request.start",
    function: "journal-next-question",
    phase: "journal_question",
    model,
    user_id: user.id,
    request_summary: requestSummary,
  });

  const httpReferer = Deno.env.get("OPENROUTER_HTTP_REFERER");
  const orHeaders: Record<string, string> = {
    Authorization: `Bearer ${openrouterKey}`,
    "Content-Type": "application/json",
    "X-Title": "Sanctuary",
  };
  if (httpReferer) {
    orHeaders["HTTP-Referer"] = httpReferer;
  }

  let rawContent: string;
  const startMs = Date.now();

  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: orHeaders,
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - startMs;

    if (!orRes.ok) {
      const errText = await orRes.text();
      logAiError({
        event: "ai.error",
        function: "journal-next-question",
        phase: "journal_question",
        model,
        user_id: user.id,
        error: {
          message: "OpenRouter request failed",
          http_status: orRes.status,
          kind: "openrouter_http",
        },
        request_summary: { ...requestSummary, latency_ms: latencyMs },
        response_summary: {
          body_preview: truncateForLog(errText, 400),
        },
        openrouter_response: { http_status: orRes.status, body: errText },
      });
      return jsonResponse({ error: "AI request failed" }, 502);
    }

    const orData = (await orRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    rawContent = orData.choices?.[0]?.message?.content?.trim() ?? "";

    logAiInfo({
      event: "ai.response.complete",
      function: "journal-next-question",
      phase: "journal_question",
      model,
      user_id: user.id,
      request_summary: { ...requestSummary, latency_ms: latencyMs },
      response_summary: {
        content_chars: rawContent.length,
        content_preview: truncateForLog(rawContent, 200),
      },
    });
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    logAiError({
      event: "ai.error",
      function: "journal-next-question",
      phase: "journal_question",
      model,
      user_id: user.id,
      error: {
        message: err instanceof Error ? err.message : "OpenRouter fetch failed",
        kind: "openrouter_fetch",
      },
      request_summary: { ...requestSummary, latency_ms: latencyMs },
    });
    return jsonResponse({ error: "AI request failed" }, 502);
  }

  // Parse the AI response: expect { "question": "..." } or { "done": true }
  let parsed: { question?: unknown; done?: unknown };
  try {
    parsed = JSON.parse(stripCodeFences(rawContent)) as {
      question?: unknown;
      done?: unknown;
    };
  } catch (err) {
    logAiError({
      event: "ai.error",
      function: "journal-next-question",
      phase: "journal_question",
      model,
      user_id: user.id,
      error: {
        message: err instanceof Error ? err.message : "JSON parse failed",
        kind: "json_parse",
      },
      response_summary: {
        raw_preview: truncateForLog(rawContent),
        raw_chars: rawContent.length,
      },
    });
    return jsonResponse({ error: "AI response could not be parsed" }, 502);
  }

  if (parsed.done === true) {
    return jsonResponse({ done: true });
  }

  if (typeof parsed.question === "string" && parsed.question.trim()) {
    return jsonResponse({
      question: parsed.question.trim(),
      turn_index: currentTurnIndex,
    });
  }

  logAiError({
    event: "ai.error",
    function: "journal-next-question",
    phase: "journal_question",
    model,
    user_id: user.id,
    error: {
      message: "AI response missing valid question field",
      kind: "invalid_response_shape",
    },
    response_summary: {
      raw_preview: truncateForLog(rawContent),
      raw_chars: rawContent.length,
    },
  });
  return jsonResponse({ error: "AI returned an unexpected response" }, 502);
});
