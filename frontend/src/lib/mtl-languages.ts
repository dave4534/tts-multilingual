/**
 * Chatterbox Multilingual language codes — must match modal_app SUPPORTED_MTL_LANGUAGE_IDS.
 */
export const DEFAULT_LANGUAGE_ID = "en" as const;

export interface MtlLanguageOption {
  id: string;
  label: string;
}

/** English first, then alphabetical by display label. */
export const MTL_LANGUAGE_OPTIONS: readonly MtlLanguageOption[] = [
  { id: "en", label: "English" },
  { id: "ar", label: "Arabic" },
  { id: "zh", label: "Chinese" },
  { id: "da", label: "Danish" },
  { id: "nl", label: "Dutch" },
  { id: "fi", label: "Finnish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "el", label: "Greek" },
  { id: "he", label: "Hebrew" },
  { id: "hi", label: "Hindi" },
  { id: "it", label: "Italian" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "ms", label: "Malay" },
  { id: "no", label: "Norwegian" },
  { id: "pl", label: "Polish" },
  { id: "pt", label: "Portuguese" },
  { id: "ru", label: "Russian" },
  { id: "es", label: "Spanish" },
  { id: "sv", label: "Swedish" },
  { id: "sw", label: "Swahili" },
  { id: "tr", label: "Turkish" },
] as const;

export function getMtlLanguageLabel(id: string): string {
  const found = MTL_LANGUAGE_OPTIONS.find((o) => o.id === id);
  return found?.label ?? id;
}

/** Main text area placeholder when output language is not Hebrew. */
export const TEXT_INPUT_PLACEHOLDER_EN = "Type or paste your text here";

/** RTL Hebrew placeholder when output language is Hebrew. */
export const TEXT_INPUT_PLACEHOLDER_HE = "הקלד או הדבק את הטקסט כאן";

export function getTextInputPlaceholder(languageId: string): string {
  return languageId.trim().toLowerCase() === "he"
    ? TEXT_INPUT_PLACEHOLDER_HE
    : TEXT_INPUT_PLACEHOLDER_EN;
}

export function getTextInputDir(languageId: string): "ltr" | "rtl" {
  return languageId.trim().toLowerCase() === "he" ? "rtl" : "ltr";
}
