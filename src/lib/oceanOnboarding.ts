import { supabase } from "@/lib/supabase";
import type { OceanDimension } from "@/types/oceanProfile";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const OCEAN_QUESTIONS_V1: ReadonlyArray<{
  readonly id: number;
  readonly dimension: OceanDimension;
  readonly required: boolean;
  readonly text: string;
}> = [
  {
    id: 1,
    dimension: "openness",
    required: true,
    text: "What's something you've been curious about recently — an idea, a place, or a way of doing things that caught your attention?",
  },
  {
    id: 2,
    dimension: "conscientiousness",
    required: true,
    text: "When you think about the things you want to get done, what tends to help you follow through — and what tends to get in the way?",
  },
  {
    id: 3,
    dimension: "extraversion",
    required: true,
    text: "How do you tend to recharge after a busy or draining day? Describe what that usually looks like for you.",
  },
  {
    id: 4,
    dimension: "agreeableness",
    required: true,
    text: "Tell me about someone in your life you feel close to. What do you value most in that relationship?",
  },
  {
    id: 5,
    dimension: "neuroticism",
    required: true,
    text: "What's been weighing on your mind lately? When that kind of feeling shows up, how do you usually sit with it?",
  },
  {
    id: 6,
    dimension: "openness",
    required: false,
    text: "Is there a creative pursuit, habit, or new way of thinking you've been wanting to explore but haven't made space for yet?",
  },
  {
    id: 7,
    dimension: "conscientiousness",
    required: false,
    text: "Describe a time when you felt really on top of things — organised, clear, in flow. What made that possible?",
  },
] as const;

const ONBOARDING_KEY_PREFIX = "sanctuary:onboarding_complete:";

export async function checkOnboardingComplete(
  userId: string,
): Promise<boolean> {
  // Fast path: local cache hit (same device, already onboarded)
  const cached = await AsyncStorage.getItem(
    `${ONBOARDING_KEY_PREFIX}${userId}`,
  );
  if (cached === "true") return true;

  // Fallback: check the database so the flag travels across devices
  const { data } = await supabase
    .from("ocean_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) {
    // Backfill the local cache so the next cold-start is instant
    await AsyncStorage.setItem(`${ONBOARDING_KEY_PREFIX}${userId}`, "true");
    return true;
  }

  return false;
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  await AsyncStorage.setItem(`${ONBOARDING_KEY_PREFIX}${userId}`, "true");
}
