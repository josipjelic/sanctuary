/**
 * journal-next-question edge function.
 *
 * Stateless single-shot per turn (ADR-006 Decision 1): client sends full turn
 * history and the server returns the next question or { done: true }.
 *
 * Turn 0: returns JOURNAL_OPENING_QUESTION_V1 instantly — always the same,
 * never AI-generated (ADR-006 Decision 3).
 * Turns 1–2: AI-generated sub-questions that explore the user's Q1 answer,
 * informed by user_state + check-in + OCEAN context.
 * Turns 3–4: optional AI-generated lookback questions drawn from the user's
 * completed journal entries over the past 7 days. Returns { done: true }
 * immediately if no recent entries exist or the AI finds nothing to ask.
 * turns.length >= 5: returns { done: true } unconditionally (server-side cap).
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

const MAX_TURNS = 5;

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

interface RecentEntry {
  session_id: string;
  completed_at: string;
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

function formatRecentEntriesForPrompt(entries: RecentEntry[]): string {
  const sessionMap = new Map<string, RecentEntry[]>();
  for (const e of entries) {
    if (!sessionMap.has(e.session_id)) sessionMap.set(e.session_id, []);
    sessionMap.get(e.session_id)!.push(e);
  }

  const sections: string[] = [];
  for (const [, sessionEntries] of sessionMap) {
    const sortedEntries = [...sessionEntries].sort(
      (a, b) => a.turn_index - b.turn_index,
    );
    const date = sortedEntries[0].completed_at.slice(0, 10);
    const qas = sortedEntries
      .map((e, i) => `Q${i + 1}: ${e.question}\nA${i + 1}: ${e.answer}`)
      .join("\n\n");
    sections.push(`[Session from ${date}]\n${qas}`);
  }

  return sections.join("\n\n---\n\n");
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

// ── Turns 1-2: sub-questions rooted in the Q1 answer ────────────────────────

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
    `You are a compassionate journaling guide for the Sanctuary app. Your role is to ask thoughtful follow-up questions that help the user reflect more deeply on what they shared in their opening answer.

Rules:
- Your questions must be sub-questions of what the user shared in Q1 — explore and deepen that thread, do not introduce unrelated new topics
- Q2 (first follow-up) should go to the heart of what the user shared — the feeling, the situation, or the tension within it
- Q3 (second follow-up) should go one layer deeper — a why, an unexplored angle, or the emotional undercurrent
- NEVER assume anything about the user's life situation (no mentions of "your job", "your partner", "your kids", "your work" etc.) UNLESS the user has explicitly mentioned these in their answers
- If the user's context mentions unresolved struggles or ongoing challenges, gently weave them in only when it feels genuinely natural to the current thread
- Keep questions short, warm, and open-ended (max 20 words)
- If the user has shared enough meaningful reflection across all turns, respond with {"done": true} instead of a question
- Return ONLY valid JSON: {"question": "..."} or {"done": true}`,
  ];

  if (checkinBlock) {
    parts.push(checkinBlock);
  }

  if (oceanBlock) {
    parts.push(
      `User's personality (OCEAN — use to tune tone and depth, never mention directly):\n${oceanBlock}`,
    );
  }

  parts.push(
    `User's current context (may be empty for new users):\n${contextBlock}`,
  );

  return parts.join("\n\n");
}

function buildUserMessage(turns: Turn[], nextTurnIndex: number): string {
  const formatted = formatTurnsForPrompt(turns);
  return `The user has answered ${turns.length} question(s) so far. Here is the conversation:

${formatted}

This is question ${nextTurnIndex + 1} of a maximum of 3. Generate the next sub-question exploring what the user shared, or signal done if the user has reflected sufficiently.`;
}

// ── Turns 3-4: lookback questions from the past 7 days ──────────────────────

function buildLookbackSystemPrompt(
  recentEntriesFormatted: string,
): string {
  return `You are a compassionate journaling guide for the Sanctuary app. The user has just finished their main reflection for today. Your task is to ask ONE gentle follow-up question about an unresolved concern or challenge they mentioned in their journal over the past 7 days.

Rules:
- Review the recent journal entries below and identify an unresolved concern, worry, or challenge the user has been carrying
- Ask specifically how that situation has progressed, changed, or been resolved since they mentioned it
- Reference the concern naturally and warmly (e.g. "You mentioned feeling anxious about X last week — how has that been?")
- If today's session already covered a particular concern (shown in the current session Q&A below), pick a different unresolved concern OR respond with {"done": true} if nothing else stands out
- If no clear unresolved concerns appear in the recent entries at all, respond with {"done": true}
- Keep the question short and open-ended (max 25 words)
- Return ONLY valid JSON: {"question": "..."} or {"done": true}

Recent journal entries (past 7 days):
${recentEntriesFormatted}`;
}

function buildLookbackUserMessage(turns: Turn[]): string {
  const formatted = formatTurnsForPrompt(turns);
  return `Current session Q&A so far:

${formatted}

Generate a gentle follow-up question about an unresolved concern from the recent entries above, or signal done.`;
}

// ── Context fetchers ─────────────────────────────────────────────────────────

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

async function fetchRecentEntries(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  currentSessionId: string,
): Promise<RecentEntry[]> {
  try {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Step 1: fetch recent completed session IDs (up to 5 sessions)
    const { data: recentSessions, error: sessionsError } = await supabase
      .from("journal_sessions")
      .select("id, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .neq("id", currentSessionId)
      .gte("completed_at", sevenDaysAgo)
      .order("completed_at", { ascending: false })
      .limit(5);

    if (sessionsError) {
      console.warn(
        "[journal-next-question] recent sessions fetch error",
        sessionsError,
      );
      return [];
    }

    if (!recentSessions || recentSessions.length === 0) return [];

    const sessionMap = new Map(
      (recentSessions as { id: string; completed_at: string }[]).map((s) => [
        s.id,
        s.completed_at,
      ]),
    );
    const sessionIds = [...sessionMap.keys()];

    // Step 2: fetch answered entries for those sessions
    const { data: entries, error: entriesError } = await supabase
      .from("journal_entries")
      .select("session_id, turn_index, question, answer")
      .in("session_id", sessionIds)
      .not("answer", "is", null)
      .order("turn_index", { ascending: true });

    if (entriesError) {
      console.warn(
        "[journal-next-question] recent entries fetch error",
        entriesError,
      );
      return [];
    }

    if (!entries) return [];

    return (
      entries as {
        session_id: string;
        turn_index: number;
        question: string;
        answer: string;
      }[]
    ).map((e) => ({
      session_id: e.session_id,
      completed_at: sessionMap.get(e.session_id) ?? "",
      turn_index: e.turn_index,
      question: e.question,
      answer: e.answer,
    }));
  } catch {
    return [];
  }
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

  // Turn 0: always return the constant opening question immediately — never AI-generated (ADR-006 Decision 3)
  if (currentTurnIndex === 0) {
    return jsonResponse({
      question: JOURNAL_OPENING_QUESTION_V1,
      turn_index: 0,
    });
  }

  // Server-side 5-turn cap (ADR-006 Decision 1 — authoritative enforcement)
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
    "google/gemini-2.5-flash-lite";

  const httpReferer = Deno.env.get("OPENROUTER_HTTP_REFERER");
  const orHeaders: Record<string, string> = {
    Authorization: `Bearer ${openrouterKey}`,
    "Content-Type": "application/json",
    "X-Title": "Sanctuary",
  };
  if (httpReferer) {
    orHeaders["HTTP-Referer"] = httpReferer;
  }

  // ── Turns 1-2: sub-questions exploring the Q1 answer ──────────────────────
  if (currentTurnIndex <= 2) {
    const [userStateContent, checkinContext, oceanProfile] = await Promise.all([
      supabase
        .from("user_state")
        .select("content")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.warn(
              "[journal-next-question] user_state fetch error",
              error,
            );
          }
          return (data as { content?: string | null } | null)?.content ?? null;
        }),
      fetchCheckinContext(supabase, user.id),
      fetchOceanProfile(supabase, user.id),
    ]);

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

    const startMs = Date.now();

    let rawContent: string;
    try {
      const orRes = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: orHeaders,
          body: JSON.stringify(requestBody),
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
            message: "OpenRouter request failed",
            http_status: orRes.status,
            kind: "openrouter_http",
          },
          request_summary: { ...requestSummary, latency_ms: latencyMs },
          response_summary: { body_preview: truncateForLog(errText, 400) },
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
          message:
            err instanceof Error ? err.message : "OpenRouter fetch failed",
          kind: "openrouter_fetch",
        },
        request_summary: { ...requestSummary, latency_ms: latencyMs },
      });
      return jsonResponse({ error: "AI request failed" }, 502);
    }

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
  }

  // ── Turns 3-4: lookback questions from the past 7 days ────────────────────
  const recentEntries = await fetchRecentEntries(
    supabase,
    user.id,
    sessionId,
  );

  // No past material — skip lookback entirely
  if (recentEntries.length === 0) {
    return jsonResponse({ done: true });
  }

  const recentEntriesFormatted = formatRecentEntriesForPrompt(recentEntries);
  const systemPrompt = buildLookbackSystemPrompt(recentEntriesFormatted);
  const userMessage = buildLookbackUserMessage(turns);

  const requestBody = {
    model,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ],
  };

  const requestSummary = {
    session_id: sessionId,
    turn_index: currentTurnIndex,
    turn_count: turns.length,
    recent_entry_count: recentEntries.length,
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

  const startMs = Date.now();

  let rawContent: string;
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
          message: "OpenRouter request failed (lookback)",
          http_status: orRes.status,
          kind: "openrouter_http",
        },
        request_summary: { ...requestSummary, latency_ms: latencyMs },
        response_summary: { body_preview: truncateForLog(errText, 400) },
        openrouter_response: { http_status: orRes.status, body: errText },
      });
      // Graceful degradation: end session rather than surface an error for optional turns
      return jsonResponse({ done: true });
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
    // Graceful degradation for optional turns
    return jsonResponse({ done: true });
  }

  let parsed: { question?: unknown; done?: unknown };
  try {
    parsed = JSON.parse(stripCodeFences(rawContent)) as {
      question?: unknown;
      done?: unknown;
    };
  } catch {
    // Graceful degradation for optional turns
    return jsonResponse({ done: true });
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

  // Graceful degradation for optional turns
  return jsonResponse({ done: true });
});
