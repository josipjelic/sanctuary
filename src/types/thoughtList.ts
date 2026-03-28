import type { Thought } from "@/types/thought";

/** Fields needed for inbox / library thought rows. */
export type ThoughtListPreview = Pick<
  Thought,
  | "id"
  | "body"
  | "topics"
  | "transcription_status"
  | "tagging_status"
  | "created_at"
>;
