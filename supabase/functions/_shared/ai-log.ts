/**
 * Structured AI I/O logging for Supabase Edge Functions (ADR-003).
 * Single-line JSON only; never log secrets, raw audio, or full multipart bodies.
 */

export type AiLogPhase = "transcribe" | "topics";

export type AiLogEvent =
  | "ai.request.start"
  | "ai.response.complete"
  | "ai.error";

export type AiLogPayload = {
  event: AiLogEvent;
  /** Edge function name: transcribe | assign-topics */
  function: string;
  phase: AiLogPhase;
  model?: string;
  thought_id?: string;
  user_id?: string;
  request_summary?: Record<string, unknown> | string;
  response_summary?: Record<string, unknown> | string;
  error?: {
    message: string;
    http_status?: number;
    kind?: string;
  };
};

const DEFAULT_MAX = 240;

function buildRecord(payload: AiLogPayload): Record<string, unknown> {
  const o: Record<string, unknown> = {
    event: payload.event,
    function: payload.function,
    phase: payload.phase,
  };
  if (payload.model !== undefined && payload.model !== "") {
    o.model = payload.model;
  }
  if (payload.thought_id !== undefined) o.thought_id = payload.thought_id;
  if (payload.user_id !== undefined) o.user_id = payload.user_id;
  if (payload.request_summary !== undefined) {
    o.request_summary = payload.request_summary;
  }
  if (payload.response_summary !== undefined) {
    o.response_summary = payload.response_summary;
  }
  if (payload.error) {
    const err: Record<string, unknown> = { message: payload.error.message };
    if (payload.error.http_status !== undefined) {
      err.http_status = payload.error.http_status;
    }
    if (payload.error.kind !== undefined) err.kind = payload.error.kind;
    o.error = err;
  }
  return o;
}

/** Truncate user-derived strings for logs (no full transcripts/prompts per ARCHITECTURE). */
export function truncateForLog(text: string, maxChars = DEFAULT_MAX): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}…[len=${t.length}]`;
}

function serializeLine(payload: AiLogPayload): string {
  return JSON.stringify(buildRecord(payload));
}

export function logAiInfo(payload: AiLogPayload): void {
  console.log(serializeLine(payload));
}

export function logAiError(payload: AiLogPayload): void {
  console.error(serializeLine(payload));
}
