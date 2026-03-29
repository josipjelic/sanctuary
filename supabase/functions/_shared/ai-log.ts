/**
 * Structured AI I/O logging for Supabase Edge Functions (ADR-003).
 * All lines use `console.debug` (DEBUG) so dashboards can filter separately from `console.error`.
 * OpenRouter payloads are nested objects (not JSON strings) for readable parsing after `event_message` decode.
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
  /**
   * OpenRouter `chat/completions` request body as a **nested object** (sanitized: no API key;
   * voice `input_audio.data` → length placeholder). Avoid stringifying — prevents unreadable escaping in logs.
   */
  openrouter_request?: unknown;
  /**
   * OpenRouter response JSON as a **nested object** (or `{ http_status, body }` on HTTP errors).
   */
  openrouter_response?: unknown;
  error?: {
    message: string;
    http_status?: number;
    kind?: string;
  };
};

const DEFAULT_MAX = 240;
/**
 * Default max serialized length for trimming nested `openrouter_*` before whole-line clamp.
 * Hosted Supabase: **≤10,000 characters per console message**.
 */
const DEFAULT_JSON_LOG_MAX = 6_500;
const ABS_JSON_LOG_MAX = 9_000;
const LOG_LINE_TARGET = 9_850;

function denoEnvGet(key: string): string | undefined {
  try {
    const Deno = (
      globalThis as {
        Deno?: { env: { get: (k: string) => string | undefined } };
      }
    ).Deno;
    return Deno?.env?.get(key);
  } catch {
    return undefined;
  }
}

/**
 * Budget for serializing one nested `openrouter_request` / `openrouter_response` blob.
 */
export function getOpenRouterLogJsonMaxChars(): number {
  const raw = denoEnvGet("OPENROUTER_LOG_JSON_MAX_CHARS");
  if (raw === undefined || raw === "") return DEFAULT_JSON_LOG_MAX;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_JSON_LOG_MAX;
  if (n <= 0) return ABS_JSON_LOG_MAX;
  return Math.min(n, ABS_JSON_LOG_MAX);
}

/** Stringify + truncate a string (e.g. legacy previews). */
export function truncateJsonForLog(jsonStr: string): string {
  const max = getOpenRouterLogJsonMaxChars();
  if (jsonStr.length <= max) return jsonStr;
  return `${jsonStr.slice(0, max)}…[truncated json len=${jsonStr.length}]`;
}

function sanitizeContentPart(part: unknown): unknown {
  if (part === null || typeof part !== "object") return part;
  const p = part as Record<string, unknown>;
  if (
    p.type === "input_audio" &&
    p.input_audio &&
    typeof p.input_audio === "object"
  ) {
    const ia = p.input_audio as Record<string, unknown>;
    const data = ia.data;
    const len = typeof data === "string" ? data.length : 0;
    return {
      ...p,
      input_audio: {
        ...ia,
        data: `[omitted base64, length=${len} chars]`,
      },
    };
  }
  return p;
}

function sanitizeMessage(m: unknown): unknown {
  if (m === null || typeof m !== "object") return m;
  const msg = m as Record<string, unknown>;
  const content = msg.content;
  if (Array.isArray(content)) {
    return {
      ...msg,
      content: content.map((c) => sanitizeContentPart(c)),
    };
  }
  return msg;
}

/**
 * Deep-clone OpenRouter request JSON for logging: strips base64 audio, keeps text prompts and model.
 */
export function sanitizeOpenRouterRequestForLog(body: unknown): unknown {
  if (body === null || typeof body !== "object") return body;
  const b = body as Record<string, unknown>;
  const out: Record<string, unknown> = { ...b };
  if (Array.isArray(out.messages)) {
    out.messages = out.messages.map((m) => sanitizeMessage(m));
  }
  return out;
}

function buildRecord(payload: AiLogPayload): Record<string, unknown> {
  const o: Record<string, unknown> = {
    log_level: "debug",
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
  if (payload.openrouter_request !== undefined) {
    o.openrouter_request = payload.openrouter_request;
  }
  if (payload.openrouter_response !== undefined) {
    o.openrouter_response = payload.openrouter_response;
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

/** One-line human prefix for raw log streams (parse the following line as JSON). */
export function formatAiLogHeadline(payload: AiLogPayload): string {
  const tid = payload.thought_id ?? "-";
  const mid = payload.model ?? "-";
  return `[sanctuary-ai] ${payload.event} | fn=${payload.function} | phase=${payload.phase} | thought=${tid} | model=${mid}`;
}

/** Truncate user-derived strings for summaries. */
export function truncateForLog(text: string, maxChars = DEFAULT_MAX): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}…[len=${t.length}]`;
}

function shrinkNestedOpenRouterField(
  rec: Record<string, unknown>,
  key: "openrouter_request" | "openrouter_response",
): void {
  const val = rec[key];
  if (val === undefined) return;

  const sans: Record<string, unknown> = { ...rec };
  sans[key] = undefined;
  const baseLen = JSON.stringify(sans).length;
  const budget = LOG_LINE_TARGET - baseLen - 100;
  if (budget < 200) {
    rec[key] = {
      _omitted: true,
      reason: "envelope_too_large",
    };
    return;
  }

  const inner = JSON.stringify(val);
  if (inner.length <= budget) return;

  rec[key] = {
    _truncated: true,
    original_json_chars: inner.length,
    preview: `${inner.slice(0, Math.max(0, budget - 140))}…`,
  };
}

/**
 * One JSON line under Supabase’s ~10k cap, with nested OpenRouter objects (no string-in-string JSON).
 * Includes `log_summary` first for readable raw `event_message` before parsing.
 */
export function finalizeLogLine(payload: AiLogPayload): string {
  const rec: Record<string, unknown> = {
    log_summary: formatAiLogHeadline(payload),
    ...buildRecord(payload),
  };
  let line = JSON.stringify(rec);
  if (line.length <= LOG_LINE_TARGET) return line;

  shrinkNestedOpenRouterField(rec, "openrouter_request");
  line = JSON.stringify(rec);
  if (line.length <= LOG_LINE_TARGET) return line;

  shrinkNestedOpenRouterField(rec, "openrouter_response");
  line = JSON.stringify(rec);
  if (line.length <= LOG_LINE_TARGET) return line;

  rec.openrouter_request = undefined;
  rec.openrouter_response = undefined;
  line = JSON.stringify(rec);
  if (line.length <= LOG_LINE_TARGET) return line;

  return JSON.stringify({
    log_summary: formatAiLogHeadline(payload),
    log_level: "debug",
    event: payload.event,
    function: payload.function,
    phase: payload.phase,
    model: payload.model,
    thought_id: payload.thought_id,
    user_id: payload.user_id,
    error: {
      message:
        "Log line exceeded platform cap after trimming openrouter_*; see log_summary for correlation",
      kind: "log_cap",
    },
  });
}

/** Structured AI / OpenRouter logs — use DEBUG so dashboards can filter separately from errors. */
export function logAiInfo(payload: AiLogPayload): void {
  console.debug(finalizeLogLine(payload));
}

/** Same as {@link logAiInfo}: failures are still DEBUG (payload includes `error` + optional `event: ai.error`). */
export function logAiError(payload: AiLogPayload): void {
  console.debug(finalizeLogLine(payload));
}
