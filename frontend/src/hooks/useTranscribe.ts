import { useCallback, useRef, useState } from "react";
import {
  getJobStatus,
  getTranscript,
  transcribeFile,
  type JobStatus,
  type TranscriptionLanguageId,
  type TranscriptResult,
} from "@/lib/api";

const POLL_INTERVAL_MS = 2000;

export type TranscribeState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "polling"; jobId: string; progress: number; state: string }
  | { status: "complete"; jobId: string; transcript: TranscriptResult }
  | { status: "failed"; error: string };

export function useTranscribe() {
  const [state, setState] = useState<TranscribeState>({ status: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startTranscribe = useCallback(
    async (file: File, languageId: TranscriptionLanguageId) => {
      stopPolling();
      setState({ status: "submitting" });
      try {
        const { job_id } = await transcribeFile(file, languageId);
        setState({ status: "polling", jobId: job_id, progress: 0, state: "queued" });

        const poll = () => {
          getJobStatus(job_id)
            .then(async (s: JobStatus) => {
              if (s.state === "complete") {
                stopPolling();
                const transcript = await getTranscript(job_id);
                setState({ status: "complete", jobId: job_id, transcript });
              } else if (s.state === "failed") {
                stopPolling();
                setState({ status: "failed", error: s.error ?? "Transcription failed" });
              } else {
                setState({ status: "polling", jobId: job_id, progress: s.progress, state: s.state });
              }
            })
            .catch((e) => {
              stopPolling();
              setState({
                status: "failed",
                error: e instanceof Error ? e.message : "Connection lost. Please try again.",
              });
            });
        };

        pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
        poll();
      } catch (e) {
        setState({
          status: "failed",
          error: e instanceof Error ? e.message : "Something went wrong. Please try again.",
        });
      }
    },
    [stopPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    setState({ status: "idle" });
  }, [stopPolling]);

  return { state, startTranscribe, reset };
}
