export type TranscriptionStatus = "none" | "pending" | "complete" | "failed";
export type TaggingStatus = "none" | "pending" | "complete" | "failed";

export interface Thought {
  id: string;
  user_id: string;
  body: string;
  body_extended: string | null;
  topics: string[];
  has_audio: boolean;
  transcription_status: TranscriptionStatus;
  tagging_status: TaggingStatus;
  created_at: string;
  updated_at: string;
}

export type InsertThought = Omit<Thought, "id" | "created_at" | "updated_at">;
