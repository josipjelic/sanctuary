/**
 * Shared reminder detection: OpenRouter extraction of future time references → reminders table.
 * Follows the same structure and logging conventions as _shared/assign-topics.ts (ADR-002, ADR-003).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logAiError, logAiInfo, truncateForLog } from "./ai-log.ts";
import { normalizeReminderScheduledAt } from "./reminder-scheduled-at-normalize.ts";

export interface DetectRemindersParams {
  userId: string;
  thoughtId: string;
  text: string;
  /**
   * ISO 8601 "now" for the user — prefer device-local with offset (e.g. `2026-03-30T14:35:00+02:00`).
   * Server-only callers may pass UTC `Z`; pairing with `ianaTimezone` still helps the model.
   */
  currentIsoTimestamp: string;
  /** IANA tz database id from the device (e.g. `Europe/Zagreb`). Optional for older clients. */
  ianaTimezone?: string;
  supabaseClient: SupabaseClient;
  openRouterApiKey: string;
  /** Defaults to OPENROUTER_REMINDER_MODEL → OPENROUTER_TOPIC_MODEL → google/gemini-2.0-flash-001. */
  model?: string;
  /** Edge function name for structured logs. */
  callerFunction?: string;
}

/** Allow only safe IANA-style ids for the prompt (no newlines / junk). */
export function sanitizeIanaTimezone(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (t.length === 0 || t.length > 64) return undefined;
  if (!/^[\w+/\-]+$/.test(t)) return undefined;
  return t;
}

function buildReminderSystemPrompt(
  currentIsoTimestamp: string,
  ianaTimezone: string | undefined,
): string {
  const tzBlock = ianaTimezone
    ? `The user's device timezone is "${ianaTimezone}" (IANA time zone database id). `
    : "";
  const timeBlock = ianaTimezone
    ? `The current local date and time for the user is ${currentIsoTimestamp} (ISO 8601; the offset matches the user's locale clock at capture time). `
    : `The reference date and time is ${currentIsoTimestamp} (ISO 8601 — if this ends with Z, it is UTC; interpret vague local phrases carefully). `;

  return `You are a reminder extraction assistant. Given a thought or note, extract any future time references that could become reminders. ${tzBlock}${timeBlock}Return ONLY valid JSON matching this schema: { "reminders": [ { "extracted_text": "string — the relevant text snippet", "scheduled_at": "ISO 8601 datetime string" } ] }. If there are no future time references, return { "reminders": [] }. Interpret vague references ("next Monday", "Wednesday afternoon", "in 3 hours") in the user's local timezone${
    ianaTimezone ? ` (${ianaTimezone})` : ""
  }. Use 09:00 local time for morning references, 14:00 for afternoon, 19:00 for evening when no time is specified. Phrases like "u dva" / "at two" in the afternoon mean 14:00 local, not 14:00 UTC. For each reminder, scheduled_at MUST be ISO 8601 with an explicit offset that matches the user's local civil time for that instant (account for DST rules of ${
    ianaTimezone ?? "that timezone"
  } when relevant). Never use Z or +00:00 for a time the user stated in local terms — use the correct offset for ${
    ianaTimezone ?? "their timezone"
  }.`;
}

interface ReminderModelItem {
  extracted_text: string;
  scheduled_at: string;
}

interface ReminderModelJson {
  reminders: ReminderModelItem[];
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseReminderJson(raw: string): ReminderModelJson {
  const stripped = stripCodeFences(raw.trim());
  const parsed = JSON.parse(stripped) as Record<string, unknown>;

  if (!Array.isArray(parsed.reminders)) {
    throw new Error("Response JSON missing 'reminders' array");
  }

  const reminders: ReminderModelItem[] = [];
  for (const item of parsed.reminders) {
    if (item === null || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const extractedText =
      typeof r.extracted_text === "string" ? r.extracted_text.trim() : "";
    const scheduledAt =
      typeof r.scheduled_at === "string" ? r.scheduled_at.trim() : "";

    if (!extractedText || !scheduledAt) continue;

    // Basic ISO 8601 sanity check — must be parseable as a date
    const parsed_date = new Date(scheduledAt);
    if (Number.isNaN(parsed_date.getTime())) continue;

    reminders.push({
      extracted_text: extractedText,
      scheduled_at: scheduledAt,
    });
  }

  return { reminders };
}

function resolveModel(): string {
  try {
    const Deno = (
      globalThis as {
        Deno?: { env: { get: (k: string) => string | undefined } };
      }
    ).Deno;
    return (
      Deno?.env?.get("OPENROUTER_REMINDER_MODEL") ??
      Deno?.env?.get("OPENROUTER_TOPIC_MODEL") ??
      "google/gemini-2.0-flash-001"
    );
  } catch {
    return "google/gemini-2.0-flash-001";
  }
}

/**
 * Detects future time references in a thought and inserts inactive reminder rows.
 * Sets `reminder_detection_status` on the thought row throughout.
 * Always resolves — callers must `.catch()` at the call site for fire-and-forget use.
 */
export async function detectRemindersForThought(
  params: DetectRemindersParams,
): Promise<void> {
  const {
    userId,
    thoughtId,
    text,
    currentIsoTimestamp,
    ianaTimezone: ianaRaw,
    supabaseClient,
    openRouterApiKey,
    model: modelOverride,
    callerFunction = "detect-reminders",
  } = params;

  const ianaTimezone = sanitizeIanaTimezone(ianaRaw) ?? undefined;

  const model = modelOverride ?? resolveModel();

  // 1. Mark detection as pending
  await supabaseClient
    .from("thoughts")
    .update({ reminder_detection_status: "pending" })
    .eq("id", thoughtId);

  // 2. Build prompt and call OpenRouter
  const systemPrompt = buildReminderSystemPrompt(
    currentIsoTimestamp,
    ianaTimezone,
  );

  const requestBody = {
    model,
    messages: [
      {
        role: "user" as const,
        content: text.trim(),
      },
    ],
    temperature: 0,
  };

  const orHeaders: Record<string, string> = {
    Authorization: `Bearer ${openRouterApiKey}`,
    "Content-Type": "application/json",
    "X-Title": "Sanctuary",
  };

  logAiInfo({
    event: "ai.request.start",
    function: callerFunction,
    phase: "reminders",
    model,
    thought_id: thoughtId,
    user_id: userId,
    request_summary: {
      thought_text_chars: text.trim().length,
      thought_text_preview: truncateForLog(text),
      current_timestamp: currentIsoTimestamp,
      ...(ianaTimezone ? { iana_timezone: ianaTimezone } : {}),
    },
    openrouter_request: {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: truncateForLog(text, 120),
        },
      ],
      temperature: 0,
    },
  });

  // Add system message to actual request (logged separately to avoid duplicating full prompt)
  const fullRequestBody = {
    ...requestBody,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: text.trim() },
    ],
  };

  const callStart = Date.now();
  let orRes: Response;
  try {
    orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: orHeaders,
      body: JSON.stringify(fullRequestBody),
    });
  } catch (fetchErr) {
    const errMsg =
      fetchErr instanceof Error ? fetchErr.message : "Network error";
    logAiError({
      event: "ai.error",
      function: callerFunction,
      phase: "reminders",
      model,
      thought_id: thoughtId,
      user_id: userId,
      error: { message: errMsg, kind: "network_error" },
    });
    await supabaseClient
      .from("thoughts")
      .update({ reminder_detection_status: "failed" })
      .eq("id", thoughtId);
    return;
  }

  if (!orRes.ok) {
    const errText = await orRes.text();
    logAiError({
      event: "ai.error",
      function: callerFunction,
      phase: "reminders",
      model,
      thought_id: thoughtId,
      user_id: userId,
      error: {
        message: "OpenRouter request failed",
        http_status: orRes.status,
        kind: "openrouter_http",
      },
      response_summary: {
        body_preview: truncateForLog(errText, 400),
      },
      openrouter_response: {
        http_status: orRes.status,
        body: errText,
      },
    });
    await supabaseClient
      .from("thoughts")
      .update({ reminder_detection_status: "failed" })
      .eq("id", thoughtId);
    return;
  }

  const orData = (await orRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = orData.choices?.[0]?.message?.content?.trim() ?? "";

  // 3. Parse JSON response
  let parsed: ReminderModelJson;
  try {
    parsed = parseReminderJson(rawContent);
  } catch (parseErr) {
    logAiError({
      event: "ai.error",
      function: callerFunction,
      phase: "reminders",
      model,
      thought_id: thoughtId,
      user_id: userId,
      error: {
        message:
          parseErr instanceof Error
            ? parseErr.message
            : "Reminder JSON parse failed",
        kind: "reminder_json_parse",
      },
      response_summary: {
        raw_preview: truncateForLog(rawContent),
        raw_chars: rawContent.length,
      },
      openrouter_response: { assistant_message_text: rawContent },
    });
    await supabaseClient
      .from("thoughts")
      .update({ reminder_detection_status: "failed" })
      .eq("id", thoughtId);
    return;
  }

  const latencyMs = Date.now() - callStart;

  // 4. No reminders found — mark complete and return
  if (parsed.reminders.length === 0) {
    logAiInfo({
      event: "ai.response.complete",
      function: callerFunction,
      phase: "reminders",
      model,
      thought_id: thoughtId,
      user_id: userId,
      response_summary: {
        reminder_count: 0,
        latency_ms: latencyMs,
      },
      openrouter_response: orData,
    });
    await supabaseClient
      .from("thoughts")
      .update({ reminder_detection_status: "complete" })
      .eq("id", thoughtId);
    return;
  }

  // 5. Insert reminder rows (status = 'inactive', RLS scoped to user)
  const rows = parsed.reminders.map((r) => ({
    user_id: userId,
    thought_id: thoughtId,
    extracted_text: r.extracted_text,
    scheduled_at: normalizeReminderScheduledAt(r.scheduled_at, ianaTimezone),
    status: "inactive" as const,
    updated_at: new Date().toISOString(),
  }));

  const { error: insertErr } = await supabaseClient
    .from("reminders")
    .insert(rows);

  if (insertErr) {
    console.error("[detect-reminders] reminders insert error", insertErr);
    logAiError({
      event: "ai.error",
      function: callerFunction,
      phase: "reminders",
      model,
      thought_id: thoughtId,
      user_id: userId,
      error: {
        message: "Failed to insert reminder rows",
        kind: "db_insert",
      },
      response_summary: {
        reminder_count: rows.length,
        latency_ms: latencyMs,
      },
    });
    await supabaseClient
      .from("thoughts")
      .update({ reminder_detection_status: "failed" })
      .eq("id", thoughtId);
    return;
  }

  // 6. Mark complete
  logAiInfo({
    event: "ai.response.complete",
    function: callerFunction,
    phase: "reminders",
    model,
    thought_id: thoughtId,
    user_id: userId,
    response_summary: {
      reminder_count: rows.length,
      latency_ms: latencyMs,
      reminders_preview: parsed.reminders
        .map(
          (r) => `${truncateForLog(r.extracted_text, 60)} → ${r.scheduled_at}`,
        )
        .join("; "),
    },
    openrouter_response: orData,
  });

  await supabaseClient
    .from("thoughts")
    .update({ reminder_detection_status: "complete" })
    .eq("id", thoughtId);
}
