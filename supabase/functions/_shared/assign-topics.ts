/**
 * Shared topic assignment: OpenRouter + user_topics / thought_topics + thoughts.topics sync.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logAiError, logAiInfo, truncateForLog } from "./ai-log.ts";

/** Reuse scores above this threshold to pick an existing user topic (model-reported 0–1). */
export const TOPIC_MATCH_THRESHOLD = 0.2;

export interface AssignTopicsParams {
  supabase: SupabaseClient;
  userId: string;
  thoughtId: string;
  text: string;
  openrouterKey: string;
  model: string;
  httpReferer?: string;
  /** Edge function name for structured logs (default assign-topics). */
  callerFunction?: "transcribe" | "assign-topics";
}

export interface AssignTopicsSuccess {
  thought_id: string;
  topics: string[];
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function normalizeTopicLabel(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

interface TopicModelJson {
  best_existing_normalized_name: string | null;
  best_match_score: number;
  new_topic: string | null;
}

function parseTopicJson(raw: string): TopicModelJson {
  const stripped = stripCodeFences(raw.trim());
  const parsed = JSON.parse(stripped) as Record<string, unknown>;
  const best_existing =
    parsed.best_existing_normalized_name === null ||
    parsed.best_existing_normalized_name === undefined
      ? null
      : String(parsed.best_existing_normalized_name).trim() || null;
  const scoreRaw = parsed.best_match_score;
  const best_match_score =
    typeof scoreRaw === "number" && !Number.isNaN(scoreRaw)
      ? Math.min(1, Math.max(0, scoreRaw))
      : 0;
  const new_topic =
    parsed.new_topic === null || parsed.new_topic === undefined
      ? null
      : String(parsed.new_topic).trim() || null;
  return {
    best_existing_normalized_name: best_existing
      ? normalizeTopicLabel(best_existing)
      : null,
    best_match_score,
    new_topic: new_topic ? normalizeTopicLabel(new_topic) : null,
  };
}

type OpenRouterChatRequestBody = {
  model: string;
  messages: Array<{ role: "user"; content: string }>;
};

async function callOpenRouter(
  openrouterKey: string,
  requestBody: OpenRouterChatRequestBody,
  httpReferer: string | undefined,
  log: {
    edgeFunction: "transcribe" | "assign-topics";
    thoughtId: string;
    userId: string;
  },
): Promise<string> {
  const orHeaders: Record<string, string> = {
    Authorization: `Bearer ${openrouterKey}`,
    "Content-Type": "application/json",
    "X-Title": "Sanctuary",
  };
  if (httpReferer) {
    orHeaders["HTTP-Referer"] = httpReferer;
  }

  const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: orHeaders,
    body: JSON.stringify(requestBody),
  });

  if (!orRes.ok) {
    const errText = await orRes.text();
    logAiError({
      event: "ai.error",
      function: log.edgeFunction,
      phase: "topics",
      model: requestBody.model,
      thought_id: log.thoughtId,
      user_id: log.userId,
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
    throw new Error("OpenRouter request failed");
  }

  const orData = (await orRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = orData.choices?.[0]?.message?.content?.trim() ?? "";

  logAiInfo({
    event: "ai.response.complete",
    function: log.edgeFunction,
    phase: "topics",
    model: requestBody.model,
    thought_id: log.thoughtId,
    user_id: log.userId,
    response_summary: {
      content_chars: content.length,
      content_preview: truncateForLog(content),
    },
    openrouter_response: orData,
  });

  return content;
}

/**
 * Assigns exactly one primary topic to a thought (reuse existing or create new).
 * Updates tagging_status and thoughts.topics (single-element array).
 */
export async function assignTopicsToThought(
  params: AssignTopicsParams,
): Promise<AssignTopicsSuccess | { error: string }> {
  const {
    supabase,
    userId,
    thoughtId,
    text,
    openrouterKey,
    model,
    httpReferer,
    callerFunction = "assign-topics",
  } = params;

  await supabase
    .from("thoughts")
    .update({ tagging_status: "pending" })
    .eq("id", thoughtId);

  const { data: rows, error: topicsError } = await supabase
    .from("user_topics")
    .select("id, name, normalized_name")
    .eq("user_id", userId)
    .order("normalized_name", { ascending: true });

  if (topicsError) {
    console.error("user_topics select error", topicsError);
    await supabase
      .from("thoughts")
      .update({ tagging_status: "failed" })
      .eq("id", thoughtId);
    return { error: "Failed to load topics" };
  }

  const existing = (rows ?? []) as Array<{
    id: string;
    name: string;
    normalized_name: string;
  }>;
  const byNormalized = new Map(
    existing.map((r) => [r.normalized_name, r] as const),
  );

  const catalogJson = JSON.stringify(
    existing.map((r) => ({
      normalized_name: r.normalized_name,
      name: r.name,
    })),
  );

  const prompt = `You classify a personal thought into exactly ONE topic for this user.
Existing topics (JSON array). Match using normalized_name:
${catalogJson}

Thought text:
${text.trim()}

Reply with ONLY raw JSON (no markdown fences), this exact shape:
{"best_existing_normalized_name": string | null, "best_match_score": number, "new_topic": string | null}

Rules:
- best_match_score is 0–1: your confidence that the thought fits the SINGLE best existing topic.
- If there is NO existing topic (empty array), set best_existing_normalized_name to null, best_match_score to 0, and new_topic to a short lowercase label (1–4 words).
- If best_match_score > ${TOPIC_MATCH_THRESHOLD} and one existing topic clearly fits, set best_existing_normalized_name to that topic's normalized_name and new_topic to null.
- Otherwise (weak or no fit, score <= ${TOPIC_MATCH_THRESHOLD}), set best_existing_normalized_name to null, set best_match_score to the best weak score (<= ${TOPIC_MATCH_THRESHOLD}), and set new_topic to a short new lowercase label.
- Never invent a normalized_name that is not in the existing list unless you are using the new_topic path.`;

  const topicOpenRouterBody: OpenRouterChatRequestBody = {
    model,
    messages: [{ role: "user", content: prompt }],
  };

  logAiInfo({
    event: "ai.request.start",
    function: callerFunction,
    phase: "topics",
    model,
    thought_id: thoughtId,
    user_id: userId,
    request_summary: {
      catalog_topic_count: existing.length,
      thought_text_chars: text.trim().length,
      thought_text_preview: truncateForLog(text),
      prompt_chars: prompt.length,
    },
    openrouter_request: topicOpenRouterBody,
  });

  let rawContent: string;
  try {
    rawContent = await callOpenRouter(
      openrouterKey,
      topicOpenRouterBody,
      httpReferer,
      {
        edgeFunction: callerFunction,
        thoughtId,
        userId,
      },
    );
  } catch {
    await supabase
      .from("thoughts")
      .update({ tagging_status: "failed" })
      .eq("id", thoughtId);
    return { error: "Topic assignment failed" };
  }

  let parsed: TopicModelJson;
  try {
    parsed = parseTopicJson(rawContent);
  } catch (err) {
    logAiError({
      event: "ai.error",
      function: callerFunction,
      phase: "topics",
      model,
      thought_id: thoughtId,
      user_id: userId,
      error: {
        message: err instanceof Error ? err.message : "Topic JSON parse failed",
        kind: "topic_json_parse",
      },
      openrouter_response: {
        assistant_message_text: rawContent,
      },
      response_summary: {
        raw_preview: truncateForLog(rawContent),
        raw_chars: rawContent.length,
      },
    });
    await supabase
      .from("thoughts")
      .update({ tagging_status: "failed" })
      .eq("id", thoughtId);
    return { error: "Topic assignment failed" };
  }

  let topicId: string;
  let topicName: string;

  const hasExisting = existing.length > 0;
  const reuse =
    hasExisting &&
    parsed.best_match_score > TOPIC_MATCH_THRESHOLD &&
    parsed.best_existing_normalized_name &&
    byNormalized.has(parsed.best_existing_normalized_name);

  if (reuse) {
    const existingKey = parsed.best_existing_normalized_name;
    const row = existingKey ? byNormalized.get(existingKey) : undefined;
    if (!row) {
      await supabase
        .from("thoughts")
        .update({ tagging_status: "failed" })
        .eq("id", thoughtId);
      return { error: "Topic assignment failed" };
    }
    topicId = row.id;
    topicName = row.name;
  } else {
    const rawNew = parsed.new_topic?.trim();
    if (!rawNew) {
      console.error("Topic assignment: missing new_topic", parsed);
      await supabase
        .from("thoughts")
        .update({ tagging_status: "failed" })
        .eq("id", thoughtId);
      return { error: "Topic assignment failed" };
    }
    const normalized_name = normalizeTopicLabel(rawNew);
    if (!normalized_name) {
      await supabase
        .from("thoughts")
        .update({ tagging_status: "failed" })
        .eq("id", thoughtId);
      return { error: "Topic assignment failed" };
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("user_topics")
      .insert({
        user_id: userId,
        name: normalized_name,
        normalized_name,
        updated_at: new Date().toISOString(),
      })
      .select("id, name")
      .single();

    if (insertErr) {
      const { data: existingRow } = await supabase
        .from("user_topics")
        .select("id, name")
        .eq("user_id", userId)
        .eq("normalized_name", normalized_name)
        .maybeSingle();

      if (existingRow) {
        topicId = (existingRow as { id: string; name: string }).id;
        topicName = (existingRow as { id: string; name: string }).name;
      } else {
        console.error("user_topics insert error", insertErr);
        await supabase
          .from("thoughts")
          .update({ tagging_status: "failed" })
          .eq("id", thoughtId);
        return { error: "Failed to save topic" };
      }
    } else {
      topicId = (inserted as { id: string; name: string }).id;
      topicName = (inserted as { id: string; name: string }).name;
    }
  }

  await supabase.from("thought_topics").delete().eq("thought_id", thoughtId);

  const { error: linkErr } = await supabase.from("thought_topics").insert({
    thought_id: thoughtId,
    topic_id: topicId,
  });

  if (linkErr) {
    console.error("thought_topics insert error", linkErr);
    await supabase
      .from("thoughts")
      .update({ tagging_status: "failed" })
      .eq("id", thoughtId);
    return { error: "Failed to link topic" };
  }

  const topics = [topicName];
  const { error: updateError } = await supabase
    .from("thoughts")
    .update({
      topics,
      tagging_status: "complete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", thoughtId);

  if (updateError) {
    console.error("thoughts topic update error", updateError);
    return { error: "Failed to save topics on thought" };
  }

  return { thought_id: thoughtId, topics };
}
