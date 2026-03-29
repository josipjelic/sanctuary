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
  /**
   * Sanitized JSON of the OpenRouter `chat/completions` request body (no API key in body;
   * `input_audio.data` replaced with a length placeholder). Truncated per `OPENROUTER_LOG_JSON_MAX_CHARS`.
   */
  openrouter_request_json?: string;
  /**
   * JSON of the OpenRouter response body (or error body / wrapper). Truncated per env.
   */
  openrouter_response_json?: string;
  error?: {
    message: string;
    http_status?: number;
    kind?: string;
  };
};

const DEFAULT_MAX = 240;
/**
 * Default max chars per `openrouter_*_json` string *before* the final line clamp.
 * Hosted Supabase allows **≤10,000 characters per console message** (see Supabase Functions logging docs);
 * the full JSON envelope (event, summaries, ids) must share that budget.
 */
const DEFAULT_JSON_LOG_MAX = 6_500;
/** Never exceed this for a single field; whole line is clamped again in `finalizeLogLine`. */
const ABS_JSON_LOG_MAX = 9_000;
/** Supabase-hosted hard limit per `console.log` / `console.error` message. */
const SUPABASE_LOG_LINE_MAX = 10_000;
/** Target max serialized line (leave margin for encoding quirks). */
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
 * Max characters for each `openrouter_*_json` string (before final whole-line clamp).
 * On **hosted Supabase**, log lines cannot exceed ~10k chars total; values above ~9k are clamped.
 * Set `OPENROUTER_LOG_JSON_MAX_CHARS` to lower this if you need shorter lines.
 */
export function getOpenRouterLogJsonMaxChars(): number {
  const raw = denoEnvGet("OPENROUTER_LOG_JSON_MAX_CHARS");
  if (raw === undefined || raw === "") return DEFAULT_JSON_LOG_MAX;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_JSON_LOG_MAX;
  if (n <= 0) return ABS_JSON_LOG_MAX;
  return Math.min(n, ABS_JSON_LOG_MAX);
}

/** Stringify + truncate for one log field. */
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
  if (payload.openrouter_request_json !== undefined) {
    o.openrouter_request_json = payload.openrouter_request_json;
  }
  if (payload.openrouter_response_json !== undefined) {
    o.openrouter_response_json = payload.openrouter_response_json;
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

/**
 * Ensures one `console.*` message stays under Supabase's per-line cap while keeping valid JSON.
 */
export function finalizeLogLine(payload: AiLogPayload): string {
  const rec = buildRecord(payload);
  let line = JSON.stringify(rec);
  if (line.length <= LOG_LINE_TARGET) return line;

  const trimField = (
    key: "openrouter_request_json" | "openrouter_response_json",
  ) => {
    const v = rec[key];
    if (typeof v !== "string") return;
    const clone = { ...rec };
    delete clone[key];
    const baseLen = JSON.stringify(clone).length;
    const room = Math.max(120, LOG_LINE_TARGET - baseLen - 96);
    rec[key] =
      v.length <= room
        ? v
        : `${v.slice(0, room)}…[truncated json len=${v.length}]`;
    line = JSON.stringify(rec);
  };

  trimField("openrouter_request_json");
  if (line.length <= LOG_LINE_TARGET) return line;
  trimField("openrouter_response_json");
  if (line.length <= LOG_LINE_TARGET) return line;

  rec.openrouter_request_json = undefined;
  rec.openrouter_response_json = undefined;
  line = JSON.stringify(rec);
  if (line.length <= LOG_LINE_TARGET) return line;

  return JSON.stringify({
    event: payload.event,
    function: payload.function,
    phase: payload.phase,
    model: payload.model,
    thought_id: payload.thought_id,
    user_id: payload.user_id,
    error: {
      message:
        "Log line still exceeded platform cap after trimming openrouter_*_json; summaries omitted",
      kind: "log_cap",
    },
  });
}

export function logAiInfo(payload: AiLogPayload): void {
  console.log(finalizeLogLine(payload));
}

export function logAiError(payload: AiLogPayload): void {
  console.error(finalizeLogLine(payload));
}
