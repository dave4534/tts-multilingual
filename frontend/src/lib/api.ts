/**
 * TTS API client. Base URL from VITE_TTS_API_URL env (default: Modal deploy URL).
 */

const API_BASE = import.meta.env.VITE_TTS_API_URL ?? "https://dave4534--tts-multilingual-api.modal.run";

/** Bust browser disk cache for `<audio src>` (same path otherwise often replays an old clip). */
const PREVIEW_URL_BUST = Date.now();

export interface Voice {
  id: string;
  name: string;
  description: string;
  /** Chatterbox language codes this reference clip may be used with (e.g. `en`, `he`). */
  language_ids?: string[];
  preview_url: string | null;
  enabled?: boolean;
}

export interface JobStatus {
  job_id: string;
  state: "queued" | "warming_up" | "processing" | "complete" | "failed";
  progress: number;
  error: string | null;
}

export interface ConvertResponse {
  job_id: string;
}

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function getVoices(): Promise<{ voices: Voice[] }> {
  const res = await fetch(`${API_BASE}/voices?t=${Date.now()}`, {
    cache: "no-store",
    headers: { Pragma: "no-cache" },
  });
  if (!res.ok) throw new Error(`Failed to fetch voices: ${res.status}`);
  return res.json();
}

/** Chatterbox Multilingual BCP-ish codes: en, he, fr, … (default en). */
export async function convert(
  text: string,
  voiceId: string,
  languageId: string = "en"
): Promise<ConvertResponse> {
  const res = await fetch(`${API_BASE}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      language_id: languageId,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Convert failed: ${res.status}`);
  }
  return res.json();
}

export async function convertWithFile(
  file: File,
  voiceId: string,
  languageId: string = "en"
): Promise<ConvertResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("voice_id", voiceId);
  formData.append("language_id", languageId);
  const res = await fetch(`${API_BASE}/convert`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Convert failed: ${res.status}`);
  }
  return res.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/job/${jobId}/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

export function getDownloadUrl(jobId: string): string {
  return `${API_BASE}/job/${jobId}/download`;
}

export function getPreviewUrl(voiceId: string): string {
  const id = encodeURIComponent(voiceId);
  return `${API_BASE}/voices/preview/${id}?_=${PREVIEW_URL_BUST}`;
}

export async function extractTextFromFile(file: File): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/extract-text`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || "Failed to extract text from file");
  }
  return res.json();
}
