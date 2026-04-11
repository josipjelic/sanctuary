/**
 * journal-next-question edge function.
 *
 * Stateless single-shot per turn (ADR-006 Decision 1): client sends full turn
 * history and the server returns the next question or { done: true }.
 *
 * Turn 0: returns JOURNAL_OPENING_QUESTION_V1 immediately — no AI call.
 * Turns 1–2: calls OpenRouter with prior Q&A + user_state context.
 * turns.length >= 3: returns { done: true } unconditionally (server-side cap).
 *
 * Does NOT write to journal_entries — the mobile client owns incremental
 * persistence (ADR-006 Decision 4).
 *
 * Logging: ADR-003, phase "journal_question". Raw answer text is never logged;
 * only answer_char_count per turn.
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

function buildSystemPrompt(userStateContent: string | null): string {
  const contextBlock = userStateContent?.trim()
    ? userStateContent.trim()
    : "(No prior profile — this is a new user or their first session.)";

  return `You are a compassionate journaling guide for the Sanctuary app. Your role is to ask thoughtful follow-up questions that help the user reflect on their day.

Rules:
- NEVER assume anything about the user's life situation (no mentions of "your job", "your partner", "your kids", "your work" etc.) UNLESS the user has explicitly mentioned these in their answers
- Base your question on: (a) what the user just shared, and (b) their current context below
- If the user's context mentions unresolved struggles or ongoing challenges, gently check in about them when it feels natural — not forced
- Aim to cover both external events (things that happened) and internal experience (feelings, thoughts, reactions)
- Keep questions short, warm, and open-ended (max 20 words)
- If the user has shared enough meaningful reflection across all turns, respond with {"done": true} instead of a question
- Return ONLY valid JSON: {"question": "..."} or {"done": true}

User's current context (may be empty for new users):
${contextBlock}`;
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

  // Opening question (turn 0): return constant immediately — no AI call (ADR-006 Decision 3)
  if (currentTurnIndex === 0) {
    return jsonResponse({
      question: JOURNAL_OPENING_QUESTION_V1,
      turn_index: 0,
    });
  }

  // Follow-up question (turn 1 or 2): call OpenRouter
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const model =
    Deno.env.get("OPENROUTER_JOURNAL_MODEL") ??
    Deno.env.get("OPENROUTER_TOPIC_MODEL") ??
    "google/gemini-2.0-flash-001";

  // Read user_state.content (may be NULL for new users — handled gracefully)
  const { data: userStateRow, error: userStateError } = await supabase
    .from("user_state")
    .select("content")
    .eq("user_id", user.id)
    .maybeSingle();

  if (userStateError) {
    // Non-fatal: proceed without user state context
    console.error(
      "[journal-next-question] user_state fetch error",
      userStateError,
    );
  }

  const userStateContent: string | null =
    (userStateRow as { content?: string | null } | null)?.content ?? null;

  const systemPrompt = buildSystemPrompt(userStateContent);
  const userMessage = buildUserMessage(turns, currentTurnIndex);

  const requestBody = {
    model,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ],
  };

  // ADR-003: never log raw answer text — only char counts per turn
  const requestSummary = {
    session_id: sessionId,
    turn_index: currentTurnIndex,
    turn_count: turns.length,
    has_user_state: userStateContent !== null,
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
