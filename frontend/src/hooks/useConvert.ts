import { useCallback, useRef, useState } from "react";
import { convert, convertWithFile, getJobStatus, getDownloadUrl, type JobStatus } from "@/lib/api";

const POLL_INTERVAL_MS = 2000;

export type ConvertState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "polling"; jobId: string; progress: number; state: string }
  | { status: "complete"; jobId: string; downloadUrl: string }
  | { status: "failed"; error: string };

export function useConvert() {
  const [state, setState] = useState<ConvertState>({ status: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startConvert = useCallback(
    async (textOrFile: string | File, voiceId: string) => {
      stopPolling();
      setState({ status: "submitting" });
      try {
        const { job_id } =
          typeof textOrFile === "string"
            ? await convert(textOrFile, voiceId)
            : await convertWithFile(textOrFile, voiceId);
        setState({ status: "polling", jobId: job_id, progress: 0, state: "queued" });

        const poll = () => {
          getJobStatus(job_id)
            .then((s: JobStatus) => {
              if (s.state === "complete") {
                setState({ status: "complete", jobId: job_id, downloadUrl: getDownloadUrl(job_id) });
                stopPolling();
              } else if (s.state === "failed") {
                setState({ status: "failed", error: s.error ?? "Conversion failed" });
                stopPolling();
              } else {
                setState({ status: "polling", jobId: job_id, progress: s.progress, state: s.state });
              }
            })
            .catch((e) => {
              setState({
                status: "failed",
                error: e instanceof Error ? e.message : "Connection lost. Please try again.",
              });
              stopPolling();
            });
        };

        pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
        poll(); // first poll immediately
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

  return { state, startConvert, reset };
}
