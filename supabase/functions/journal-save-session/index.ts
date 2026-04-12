/**
 * journal-save-session edge function.
 *
 * Marks a journal session as completed and triggers a fire-and-forget user
 * state update (ADR-006 Decision 2 — incremental merge).
 *
 * Flow:
 *   1. Authenticate user via JWT.
 *   2. Verify session is 'pending' and belongs to user.
 *   3. Verify at least one journal_entries row has a non-NULL answer.
 *   4. Mark session 'completed' (awaited).
 *   5. Return { success: true } immediately.
 *   6. Fire-and-forget: updateUserState() — reads user_state.content + new
 *      session Q&A, calls OpenRouter for incremental merge, upserts user_state.
 *
 * Logging: ADR-003, phase "journal_state_update". Raw answer text and state
 * content are never logged — only answer_count, prior_state_char_count,
 * updated_state_char_count, word_count, and session_count.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
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

interface JournalEntry {
  turn_index: number;
  question: string;
  answer: string;
}

function formatSessionQAForPrompt(entries: JournalEntry[]): string {
  return entries
    .map((e, i) => `Q${i + 1}: ${e.question}\nA${i + 1}: ${e.answer}`)
    .join("\n\n");
}

/**
 * Incremental user state merge (ADR-006 Decision 2).
 * Reads the current user_state, blends in the new session's Q&A via OpenRouter,
 * and upserts the result. Called fire-and-forget — never throws.
 */
async function updateUserState(
  userId: string,
  sessionId: string,
  entries: JournalEntry[],
  supabase: SupabaseClient,
  openrouterKey: string,
  model: string,
): Promise<void> {
  const startMs = Date.now();

  // Read the current user_state row (NULL content = first session)
  const { data: stateRow, error: stateError } = await supabase
    .from("user_state")
    .select("content, session_count")
    .eq("user_id", userId)
    .maybeSingle();

  if (stateError) {
    logAiError({
      event: "ai.error",
      function: "journal-save-session",
      phase: "journal_state_update",
      model,
      user_id: userId,
      error: {
        message: "Failed to fetch user_state",
        kind: "db_read",
      },
      request_summary: { session_id: sessionId },
    });
    return;
  }

  const typedState = stateRow as {
    content?: string | null;
    session_count?: number;
  } | null;
  const priorContent: string | null = typedState?.content ?? null;
  const currentSessionCount: number = typedState?.session_count ?? 0;

  const priorBlock = priorContent?.trim()
    ? priorContent.trim()
    : "(No prior profile — this is the user's first completed session.)";

  const systemPrompt = `You are maintaining a private, evolving user profile for the Sanctuary journaling app. Your task is to write a fully synthesised, coherent profile that integrates what was already known about the user with insights from their latest journal session.

This is a COMPLETE REWRITE — do not copy the prior profile verbatim or append new observations to the end of it. Read both the prior profile and the new session, then produce a single unified profile that feels like one coherent document.

Rules:
- Write in third person (e.g. "The user..." or "They...")
- Target length: ~250 words (200–300 acceptable)
- Synthesise across: recurring themes, current struggles and challenges, recent events mentioned, emotional patterns, relationships or people mentioned, goals or intentions expressed
- NEVER infer or assume things not explicitly mentioned by the user
- Naturally weave in important context from the prior profile — do not list old facts then new facts; integrate them
- Replace or update observations that the new session contradicts or evolves
- Write observations that will remain meaningful weeks later — avoid ephemeral references like "today" or "this week"
- Output ONLY the profile text — no preamble, no headings, no meta-commentary

Prior profile (may be empty):
${priorBlock}`;

  const sessionQA = formatSessionQAForPrompt(entries);
  const userMessage = `New journal session Q&A:

${sessionQA}

Write the updated profile.`;

  const requestBody = {
    model,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ],
  };

  // ADR-003: never log raw answer text or state content — only counts
  logAiInfo({
    event: "ai.request.start",
    function: "journal-save-session",
    phase: "journal_state_update",
    model,
    user_id: userId,
    request_summary: {
      session_id: sessionId,
      answer_count: entries.length,
      has_prior_state: priorContent !== null,
      prior_state_char_count: priorContent?.length ?? 0,
      answer_char_counts: entries.map((e) => e.answer.length),
    },
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

  let updatedContent: string;
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
        function: "journal-save-session",
        phase: "journal_state_update",
        model,
        user_id: userId,
        error: {
          message: "OpenRouter request failed",
          http_status: orRes.status,
          kind: "openrouter_http",
        },
        request_summary: { session_id: sessionId, latency_ms: latencyMs },
        response_summary: { body_preview: truncateForLog(errText, 400) },
        openrouter_response: { http_status: orRes.status, body: errText },
      });
      return;
    }

    const orData = (await orRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    updatedContent = orData.choices?.[0]?.message?.content?.trim() ?? "";

    if (!updatedContent) {
      logAiError({
        event: "ai.error",
        function: "journal-save-session",
        phase: "journal_state_update",
        model,
        user_id: userId,
        error: {
          message: "Model returned empty user state content",
          kind: "empty_response",
        },
        request_summary: { session_id: sessionId, latency_ms: latencyMs },
      });
      return;
    }
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    logAiError({
      event: "ai.error",
      function: "journal-save-session",
      phase: "journal_state_update",
      model,
      user_id: userId,
      error: {
        message: err instanceof Error ? err.message : "OpenRouter fetch failed",
        kind: "openrouter_fetch",
      },
      request_summary: { session_id: sessionId, latency_ms: latencyMs },
    });
    return;
  }

  const wordCount = updatedContent.split(/\s+/).filter(Boolean).length;
  const newSessionCount = currentSessionCount + 1;
  const now = new Date().toISOString();

  // Upsert user_state using ON CONFLICT on user_id (ADR-006 Decision 2)
  // created_at intentionally omitted: defaults to now() on INSERT, preserved on UPDATE
  const { error: upsertError } = await supabase.from("user_state").upsert(
    {
      user_id: userId,
      content: updatedContent,
      word_count: wordCount,
      session_count: newSessionCount,
      last_session_id: sessionId,
      last_updated_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  const latencyMs = Date.now() - startMs;

  if (upsertError) {
    logAiError({
      event: "ai.error",
      function: "journal-save-session",
      phase: "journal_state_update",
      model,
      user_id: userId,
      error: {
        message: "Failed to upsert user_state",
        kind: "db_write",
      },
      request_summary: { session_id: sessionId, latency_ms: latencyMs },
    });
    return;
  }

  logAiInfo({
    event: "ai.response.complete",
    function: "journal-save-session",
    phase: "journal_state_update",
    model,
    user_id: userId,
    request_summary: { session_id: sessionId },
    response_summary: {
      word_count: wordCount,
      updated_state_char_count: updatedContent.length,
      session_count: newSessionCount,
      latency_ms: latencyMs,
    },
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

  const { session_id } = body as Record<string, unknown>;

  if (!session_id || typeof session_id !== "string" || !session_id.trim()) {
    return jsonResponse({ error: "session_id required" }, 400);
  }

  const sessionId = session_id.trim();

  // Fetch session — RLS + explicit user_id check (IDOR defence)
  const { data: session, error: sessionError } = await supabase
    .from("journal_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sessionError) {
    console.error("[journal-save-session] session fetch error", sessionError);
    return jsonResponse({ error: "Server error" }, 500);
  }

  if (!session) {
    return jsonResponse({ error: "Session not found" }, 403);
  }

  const typedSession = session as { id: string; status: string };

  if (typedSession.status === "completed") {
    return jsonResponse({ error: "Session already completed" }, 409);
  }

  if (typedSession.status !== "pending") {
    return jsonResponse({ error: "Session is not in a saveable state" }, 422);
  }

  // Fetch answered journal entries (answer IS NOT NULL), ordered by turn_index
  const { data: entries, error: entriesError } = await supabase
    .from("journal_entries")
    .select("turn_index, question, answer")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .not("answer", "is", null)
    .order("turn_index", { ascending: true });

  if (entriesError) {
    console.error("[journal-save-session] entries fetch error", entriesError);
    return jsonResponse({ error: "Server error" }, 500);
  }

  const answeredEntries = (entries ?? []) as JournalEntry[];

  if (answeredEntries.length === 0) {
    return jsonResponse({ error: "No answers found for session" }, 422);
  }

  // Mark session completed (awaited — must succeed before response)
  const completedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("journal_sessions")
    .update({
      status: "completed",
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[journal-save-session] session update error", updateError);
    return jsonResponse({ error: "Failed to complete session" }, 500);
  }

  // Fire-and-forget user state update (ADR-006 Decision 2)
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (openrouterKey) {
    const model =
      Deno.env.get("OPENROUTER_JOURNAL_MODEL") ??
      Deno.env.get("OPENROUTER_TOPIC_MODEL") ??
      "google/gemini-2.0-flash-001";

    updateUserState(
      user.id,
      sessionId,
      answeredEntries,
      supabase,
      openrouterKey,
      model,
    ).catch(() => {});
  } else {
    console.error(
      "[journal-save-session] OPENROUTER_API_KEY not set — skipping user state update",
    );
  }

  return jsonResponse({ success: true });
});
