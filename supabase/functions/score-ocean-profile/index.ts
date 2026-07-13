/**
 * score-ocean-profile edge function.
 * Accepts free-text OCEAN questionnaire answers, calls OpenRouter to score all
 * five Big Five dimensions, and upserts the result into `ocean_profiles`.
 * ADR-003: answer text is limited to truncated previews in logs; OCEAN scores
 * are never logged.
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

interface AnswerItem {
  question: string;
  answer: string;
}

interface OceanScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

type OceanReasoning = Record<
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism",
  string
>;

const OCEAN_DIMS = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
] as const;

function clamp01(v: number): number {
  return Math.min(1.0, Math.max(0.0, v));
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseOceanResponse(raw: string): {
  scores: OceanScores;
  reasoning: OceanReasoning;
} {
  const parsed = JSON.parse(stripCodeFences(raw)) as Record<string, unknown>;
  const scores = {} as OceanScores;
  const reasoningRaw = parsed.reasoning as Record<string, unknown> | undefined;
  const reasoning = {} as OceanReasoning;

  for (const dim of OCEAN_DIMS) {
    const v = parsed[dim];
    if (typeof v !== "number" || Number.isNaN(v)) {
      throw new Error(`Missing or invalid OCEAN dimension: ${dim}`);
    }
    scores[dim] = clamp01(v);
    reasoning[dim] =
      typeof reasoningRaw?.[dim] === "string"
        ? (reasoningRaw[dim] as string).trim()
        : "";
  }
  return { scores, reasoning };
}

const SYSTEM_PROMPT = `You are a psychometric scoring assistant. Given free-text answers from a personality questionnaire, score the respondent on the five OCEAN / Big Five dimensions and explain each score.

Scoring rules:
- Each dimension is a float from 0.0 (extremely low) to 1.0 (extremely high).
- Use the FULL range — do NOT cluster near 0.5.
- Base scores solely on the actual content, language and style of the answers.
- Scores MUST differ meaningfully unless the answers genuinely support similar levels.

Dimension guidelines:
- openness: curiosity, imagination, aesthetic sensitivity, willingness to explore new ideas
- conscientiousness: organisation, self-discipline, goal-directed behaviour, reliability
- extraversion: energy from social interaction, assertiveness, positive affect, talkativeness
- agreeableness: cooperation, trust, empathy, warmth in close relationships
- neuroticism: emotional instability, anxiety, tendency to experience negative affect

For each dimension also write 1–2 sentences of plain-language reasoning that cites specific things from the answers. Keep reasoning concise and personal (use "you / your").

Return ONLY valid JSON — no markdown fences, no extra keys. Example shape (illustrative values):
{
  "openness": 0.74,
  "conscientiousness": 0.52,
  "extraversion": 0.38,
  "agreeableness": 0.81,
  "neuroticism": 0.29,
  "reasoning": {
    "openness": "Your answers show a genuine love of exploring new ideas and creative thinking.",
    "conscientiousness": "You seem fairly organised but leave room for spontaneity in how you approach tasks.",
    "extraversion": "You draw energy from quieter, reflective time rather than social settings.",
    "agreeableness": "Your warmth and empathy come through clearly in how you describe relationships.",
    "neuroticism": "You appear emotionally steady and handle stress without much anxiety."
  }
}`;

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

  const { answers, question_set_version } = body as Record<string, unknown>;

  if (!Array.isArray(answers) || answers.length < 1 || answers.length > 7) {
    return jsonResponse(
      { error: "answers must be an array of 1–7 items" },
      400,
    );
  }

  const validatedAnswers: AnswerItem[] = [];
  for (const item of answers) {
    const entry = item as Record<string, unknown>;
    if (
      !item ||
      typeof item !== "object" ||
      typeof entry.question !== "string" ||
      typeof entry.answer !== "string" ||
      !entry.question.trim() ||
      !entry.answer.trim()
    ) {
      return jsonResponse(
        {
          error: "Each answer must have non-empty question and answer strings",
        },
        400,
      );
    }
    validatedAnswers.push({
      question: (entry.question as string).trim(),
      answer: (entry.answer as string).trim(),
    });
  }

  const questionSetVersion =
    typeof question_set_version === "string" && question_set_version.trim()
      ? question_set_version.trim()
      : "v1";

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const model =
    Deno.env.get("OPENROUTER_OCEAN_MODEL") ??
    Deno.env.get("OPENROUTER_TOPIC_MODEL") ??
    "google/gemini-2.5-flash-lite";

  const httpReferer = Deno.env.get("OPENROUTER_HTTP_REFERER");

  const answersText = validatedAnswers
    .map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.answer}`)
    .join("\n\n");

  const requestBody = {
    model,
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `Score the following personality questionnaire answers:\n\n${answersText}`,
      },
    ],
  };

  // ADR-003: answer text is sensitive — log only truncated previews, never full content.
  // Sanitize the logged request body by replacing the user message with metadata.
  const sanitizedRequestForLog = {
    model: requestBody.model,
    messages: [
      { role: "system", content: "[system prompt omitted from logs]" },
      {
        role: "user",
        content: `[${validatedAnswers.length} answers — previews in request_summary]`,
      },
    ],
  };

  logAiInfo({
    event: "ai.request.start",
    function: "score-ocean-profile",
    phase: "onboarding",
    model,
    user_id: user.id,
    request_summary: {
      answer_count: validatedAnswers.length,
      question_set_version: questionSetVersion,
      answer_previews: validatedAnswers.map((a) =>
        truncateForLog(a.answer, 80),
      ),
    },
    openrouter_request: sanitizedRequestForLog,
  });

  const orHeaders: Record<string, string> = {
    Authorization: `Bearer ${openrouterKey}`,
    "Content-Type": "application/json",
    "X-Title": "Sanctuary",
  };
  if (httpReferer) {
    orHeaders["HTTP-Referer"] = httpReferer;
  }

  let rawContent: string;
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
        function: "score-ocean-profile",
        phase: "onboarding",
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
        { error: "scoring_failed", message: "AI scoring request failed" },
        502,
      );
    }

    const orData = (await orRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    rawContent = orData.choices?.[0]?.message?.content?.trim() ?? "";

    // ADR-003: do not log OCEAN scores — omit openrouter_response content.
    logAiInfo({
      event: "ai.response.complete",
      function: "score-ocean-profile",
      phase: "onboarding",
      model,
      user_id: user.id,
      response_summary: {
        content_chars: rawContent.length,
        has_content: rawContent.length > 0,
      },
    });
  } catch (err) {
    logAiError({
      event: "ai.error",
      function: "score-ocean-profile",
      phase: "onboarding",
      model,
      user_id: user.id,
      error: {
        message: err instanceof Error ? err.message : "OpenRouter fetch failed",
        kind: "openrouter_fetch",
      },
    });
    return jsonResponse(
      { error: "scoring_failed", message: "AI scoring request failed" },
      502,
    );
  }

  let scores: OceanScores;
  let reasoning: OceanReasoning;
  try {
    ({ scores, reasoning } = parseOceanResponse(rawContent));
  } catch (err) {
    logAiError({
      event: "ai.error",
      function: "score-ocean-profile",
      phase: "onboarding",
      model,
      user_id: user.id,
      error: {
        message: err instanceof Error ? err.message : "OCEAN JSON parse failed",
        kind: "ocean_json_parse",
      },
      // ADR-003: don't log scores; log only structural metadata
      response_summary: {
        raw_chars: rawContent.length,
        raw_preview: truncateForLog(rawContent),
      },
    });
    return jsonResponse(
      { error: "scoring_failed", message: "AI returned invalid scores" },
      502,
    );
  }

  const { error: upsertError } = await supabase.from("ocean_profiles").upsert(
    {
      user_id: user.id,
      openness: scores.openness,
      conscientiousness: scores.conscientiousness,
      extraversion: scores.extraversion,
      agreeableness: scores.agreeableness,
      neuroticism: scores.neuroticism,
      reasoning,
      answers: validatedAnswers,
      question_set_version: questionSetVersion,
      scored_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    console.error(
      "[score-ocean-profile] ocean_profiles upsert error",
      upsertError,
    );
    return jsonResponse({ error: "Failed to save profile" }, 500);
  }

  return jsonResponse({ profile: scores, reasoning });
});
