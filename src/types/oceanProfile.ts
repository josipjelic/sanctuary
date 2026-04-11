export type OceanDimension =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism";

export interface OceanProfile {
  user_id: string;
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  answers: OceanAnswer[];
  question_set_version: string;
  scored_at: string;
}

export interface OceanAnswer {
  question: string;
  answer: string;
}

export interface MorningMessage {
  id: string;
  user_id: string;
  generated_for_date: string;
  message: string | null;
  shown_at: string | null;
  dismissed_at: string | null;
}
