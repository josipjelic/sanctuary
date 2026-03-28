import type { InsertThought } from "@/types/thought";

export function validateCaptureText(text: string): string | null {
  if (!text.trim()) return "Thought cannot be empty.";
  return null;
}

export function buildThoughtPayload(
  userId: string,
  text: string,
): InsertThought {
  return {
    user_id: userId,
    body: text.trim(),
    body_extended: null,
    tags: [],
    has_audio: false,
    transcription_status: "none",
    tagging_status: "none",
  };
}

export function buildVoiceThoughtPayload(userId: string): InsertThought {
  return {
    user_id: userId,
    body: "",
    body_extended: null,
    tags: [],
    has_audio: true,
    transcription_status: "pending",
    tagging_status: "none",
  };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
