import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@sanctuary/transcription_language";

/** Display order; `auto` lets the model infer language from audio. */
export const TRANSCRIPTION_LANGUAGE_OPTIONS = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "hr", label: "Croatian" },
  { code: "sr", label: "Serbian" },
  { code: "bs", label: "Bosnian" },
  { code: "sl", label: "Slovenian" },
  { code: "cs", label: "Czech" },
  { code: "sk", label: "Slovak" },
  { code: "ro", label: "Romanian" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "nb", label: "Norwegian" },
  { code: "fi", label: "Finnish" },
  { code: "el", label: "Greek" },
  { code: "tr", label: "Turkish" },
  { code: "ar", label: "Arabic" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "id", label: "Indonesian" },
  { code: "ms", label: "Malay" },
  { code: "tl", label: "Filipino" },
  { code: "sw", label: "Swahili" },
] as const;

const ALLOWED = new Set(TRANSCRIPTION_LANGUAGE_OPTIONS.map((o) => o.code));

export type TranscriptionLanguageCode =
  (typeof TRANSCRIPTION_LANGUAGE_OPTIONS)[number]["code"];

export function labelForTranscriptionCode(
  code: TranscriptionLanguageCode,
): string {
  const row = TRANSCRIPTION_LANGUAGE_OPTIONS.find((o) => o.code === code);
  return row?.label ?? "Auto-detect";
}

export async function getTranscriptionLanguage(): Promise<TranscriptionLanguageCode> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw || !ALLOWED.has(raw as TranscriptionLanguageCode)) {
    return "auto";
  }
  return raw as TranscriptionLanguageCode;
}

export async function setTranscriptionLanguage(
  code: TranscriptionLanguageCode,
): Promise<void> {
  if (!ALLOWED.has(code)) return;
  await AsyncStorage.setItem(STORAGE_KEY, code);
}
