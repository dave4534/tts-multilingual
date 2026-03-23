import type { Voice } from "@/lib/api";
import { DEFAULT_LANGUAGE_ID, getMtlLanguageLabel } from "@/lib/mtl-languages";

/** Voice can be chosen for TTS (reference exists / API enabled, not explicitly disabled). */
export function isVoiceUsableForTts(voice: Voice): boolean {
  if (voice.enabled === false) return false;
  if (voice.enabled == null && !voice.preview_url) return false;
  return true;
}

/**
 * Language codes that have at least one usable persona (reference clip on disk / enabled in API).
 * Sorted: English first, then others by display label.
 */
export function languageIdsWithUsableVoices(voices: Voice[]): string[] {
  const set = new Set<string>();
  for (const v of voices) {
    if (!isVoiceUsableForTts(v)) continue;
    for (const id of getVoiceLanguageIds(v)) {
      set.add(id);
    }
  }
  if (set.size === 0) {
    return [DEFAULT_LANGUAGE_ID];
  }
  const ids = [...set];
  ids.sort((a, b) => {
    if (a === DEFAULT_LANGUAGE_ID && b !== DEFAULT_LANGUAGE_ID) return -1;
    if (b === DEFAULT_LANGUAGE_ID && a !== DEFAULT_LANGUAGE_ID) return 1;
    return getMtlLanguageLabel(a).localeCompare(getMtlLanguageLabel(b), "en");
  });
  return ids;
}

/** Manifest `language_ids`; omitted or empty → English only (backward compatible). */
export function getVoiceLanguageIds(voice: Voice): string[] {
  const raw = voice.language_ids;
  if (!raw?.length) {
    return [DEFAULT_LANGUAGE_ID];
  }
  const out = raw
    .map((x) => String(x).trim().toLowerCase())
    .filter((x) => x.length > 0);
  return out.length > 0 ? out : [DEFAULT_LANGUAGE_ID];
}

export function voiceSupportsLanguage(voice: Voice, languageId: string): boolean {
  const lid = languageId.trim().toLowerCase();
  return getVoiceLanguageIds(voice).includes(lid);
}

export function filterVoicesByLanguage(voices: Voice[], languageId: string): Voice[] {
  return voices.filter((v) => voiceSupportsLanguage(v, languageId));
}
