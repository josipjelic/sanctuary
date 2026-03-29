/**
 * Transcribe edge function.
 * Use esm.sh + inline CORS — npm:/jsr: imports caused BOOT_ERROR (503) on hosted runtime.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  logAiError,
  logAiInfo,
  sanitizeOpenRouterRequestForLog,
  truncateForLog,
  truncateJsonForLog,
} from "../_shared/ai-log.ts";
import { assignTopicsToThought } from "../_shared/assign-topics.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function encodeBase64(bytes: Uint8Array): string {
  const chunk = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    let part = "";
    const end = Math.min(i + chunk, bytes.length);
    for (let j = i; j < end; j++) {
      const b = bytes[j];
      if (b !== undefined) part += String.fromCharCode(b);
    }
    binary += part;
  }
  return btoa(binary);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Keep in sync with `TRANSCRIPTION_LANGUAGE_OPTIONS` in `src/lib/transcriptionLanguage.ts` (codes only). */
const TRANSCRIPTION_LANG_NAMES: Record<string, string> = {
  auto: "Auto-detect",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  uk: "Ukrainian",
  hr: "Croatian",
  sr: "Serbian",
  bs: "Bosnian",
  sl: "Slovenian",
  cs: "Czech",
  sk: "Slovak",
  ro: "Romanian",
  sv: "Swedish",
  da: "Danish",
  nb: "Norwegian",
  fi: "Finnish",
  el: "Greek",
  tr: "Turkish",
  ar: "Arabic",
  he: "Hebrew",
  hi: "Hindi",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  ms: "Malay",
  tl: "Filipino",
  sw: "Swahili",
};

function normalizeTranscriptionLanguage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (t.length === 0 || t.length > 12) return null;
  return TRANSCRIPTION_LANG_NAMES[t] !== undefined ? t : null;
}

function transcriptionUserPrompt(languageCode: string | null): string {
  if (!languageCode || languageCode === "auto") {
    return "Transcribe this audio verbatim. Reply with only the spoken words, no commentary.";
  }
  const name = TRANSCRIPTION_LANG_NAMES[languageCode] ?? languageCode;
  return `The speech is in ${name} language. Transcribe this audio verbatim in that language using its normal writing system. Reply with only the spoken words, no commentary.`;
}

function audioFormatFromMime(mime: string, filename: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("audio/mp4") || m.includes("m4a"))
    return "aac";
  if (m.includes("mpeg")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("flac")) return "flac";
  if (m.includes("ogg")) return "ogg";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "webm") return "webm";
  if (ext === "m4a" || ext === "mp4") return "aac";
  if (ext === "mp3") return "mp3";
  return "aac";
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonResponse({ error: "Invalid multipart body" }, 400);
  }

  const thoughtId = formData.get("thought_id");
  const audio = formData.get("audio");
  const transcriptionLanguage = normalizeTranscriptionLanguage(
    formData.get("transcription_language"),
  );

  if (!thoughtId || typeof thoughtId !== "string") {
    return jsonResponse({ error: "thought_id required" }, 400);
  }

  if (!audio || !(audio instanceof File)) {
    return jsonResponse(
      { error: "audio file required (send a File/Blob, not a JSON object)" },
      400,
    );
  }

  const { data: thought, error: fetchError } = await supabase
    .from("thoughts")
    .select("id, user_id")
    .eq("id", thoughtId)
    .single();

  if (fetchError || !thought || thought.user_id !== user.id) {
    return jsonResponse({ error: "Thought not found" }, 404);
  }

  await supabase
    .from("thoughts")
    .update({ transcription_status: "pending" })
    .eq("id", thoughtId);

  const arrayBuffer = await audio.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64 = encodeBase64(bytes);
  const format = audioFormatFromMime(audio.type, audio.name);

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    await supabase
      .from("thoughts")
      .update({ transcription_status: "failed" })
      .eq("id", thoughtId);
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const model =
    Deno.env.get("OPENROUTER_TRANSCRIPTION_MODEL") ??
    "google/gemini-2.0-flash-001";

  const orHeaders: Record<string, string> = {
    Authorization: `Bearer ${openrouterKey}`,
    "Content-Type": "application/json",
    "X-Title": "Sanctuary",
  };
  const referer = Deno.env.get("OPENROUTER_HTTP_REFERER");
  if (referer) {
    orHeaders["HTTP-Referer"] = referer;
  }

  const transcribePrompt = transcriptionUserPrompt(transcriptionLanguage);
  const transcribeOpenRouterBody = {
    model,
    messages: [
      {
        role: "user" as const,
        content: [
          {
            type: "text",
            text: transcribePrompt,
          },
          {
            type: "input_audio",
            input_audio: {
              data: base64,
              format,
            },
          },
        ],
      },
    ],
  };
  const transcribeRequestForLog = sanitizeOpenRouterRequestForLog(
    transcribeOpenRouterBody,
  );
  logAiInfo({
    event: "ai.request.start",
    function: "transcribe",
    phase: "transcribe",
    model,
    thought_id: thoughtId,
    user_id: user.id,
    request_summary: {
      audio_mime: audio.type || "unknown",
      audio_bytes: bytes.length,
      audio_format: format,
      transcription_language: transcriptionLanguage ?? "auto",
      prompt_preview: truncateForLog(transcribePrompt),
    },
    openrouter_request_json: truncateJsonForLog(
      JSON.stringify(transcribeRequestForLog),
    ),
  });

  const transcribeStarted = Date.now();
  const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: orHeaders,
    body: JSON.stringify(transcribeOpenRouterBody),
  });

  if (!orRes.ok) {
    const errText = await orRes.text();
    logAiError({
      event: "ai.error",
      function: "transcribe",
      phase: "transcribe",
      model,
      thought_id: thoughtId,
      user_id: user.id,
      error: {
        message: "OpenRouter transcription request failed",
        http_status: orRes.status,
        kind: "openrouter_http",
      },
      response_summary: {
        body_preview: truncateForLog(errText, 400),
      },
      openrouter_response_json: truncateJsonForLog(
        JSON.stringify({ http_status: orRes.status, body: errText }),
      ),
    });
    await supabase
      .from("thoughts")
      .update({ transcription_status: "failed" })
      .eq("id", thoughtId);
    return jsonResponse({ error: "Transcription failed" }, 502);
  }

  const orData = (await orRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const transcript = orData.choices?.[0]?.message?.content?.trim() ?? "";

  if (!transcript) {
    logAiError({
      event: "ai.error",
      function: "transcribe",
      phase: "transcribe",
      model,
      thought_id: thoughtId,
      user_id: user.id,
      error: {
        message: "Empty transcript from model",
        kind: "empty_transcript",
      },
      response_summary: {
        latency_ms: Date.now() - transcribeStarted,
      },
      openrouter_response_json: truncateJsonForLog(JSON.stringify(orData)),
    });
    await supabase
      .from("thoughts")
      .update({ transcription_status: "failed" })
      .eq("id", thoughtId);
    return jsonResponse({ error: "Empty transcript" }, 502);
  }

  logAiInfo({
    event: "ai.response.complete",
    function: "transcribe",
    phase: "transcribe",
    model,
    thought_id: thoughtId,
    user_id: user.id,
    response_summary: {
      transcript_chars: transcript.length,
      transcript_preview: truncateForLog(transcript),
      latency_ms: Date.now() - transcribeStarted,
    },
    openrouter_response_json: truncateJsonForLog(JSON.stringify(orData)),
  });

  const { error: updateError } = await supabase
    .from("thoughts")
    .update({
      body: transcript,
      transcription_status: "complete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", thoughtId);

  if (updateError) {
    console.error(updateError);
    return jsonResponse({ error: "Failed to save transcript" }, 500);
  }

  const topicModel =
    Deno.env.get("OPENROUTER_TOPIC_MODEL") ??
    Deno.env.get("OPENROUTER_TAGGING_MODEL") ??
    "google/gemini-2.0-flash-001";
  const topicReferer = Deno.env.get("OPENROUTER_HTTP_REFERER");

  const topicResult = await assignTopicsToThought({
    supabase,
    userId: user.id,
    thoughtId,
    text: transcript,
    openrouterKey,
    model: topicModel,
    httpReferer: topicReferer ?? undefined,
    callerFunction: "transcribe",
  });

  const topics = "topics" in topicResult ? topicResult.topics : undefined;

  return jsonResponse({
    transcript,
    thought_id: thoughtId,
    ...(topics !== undefined ? { topics } : {}),
  });
});
