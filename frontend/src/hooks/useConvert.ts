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
      // #region agent log
      fetch("http://127.0.0.1:7616/ingest/9f1d2e0e-b35a-4f4a-bf9e-e8a6a58930f3", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2928a6" }, body: JSON.stringify({ sessionId: "2928a6", location: "useConvert.ts:start", message: "startConvert", data: { type: typeof textOrFile }, timestamp: Date.now(), hypothesisId: "A" }) }).catch(() => {});
      // #endregion
      stopPolling();
      setState({ status: "submitting" });
      try {
        const { job_id } =
          typeof textOrFile === "string"
            ? await convert(textOrFile, voiceId)
            : await convertWithFile(textOrFile, voiceId);
        // #region agent log
        fetch("http://127.0.0.1:7616/ingest/9f1d2e0e-b35a-4f4a-bf9e-e8a6a58930f3", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2928a6" }, body: JSON.stringify({ sessionId: "2928a6", location: "useConvert.ts:convertOk", message: "got job_id", data: { job_id }, timestamp: Date.now(), hypothesisId: "B" }) }).catch(() => {});
        // #endregion
        setState({ status: "polling", jobId: job_id, progress: 0, state: "queued" });

        const poll = () => {
          getJobStatus(job_id)
            .then((s: JobStatus) => {
              // #region agent log
              fetch("http://127.0.0.1:7616/ingest/9f1d2e0e-b35a-4f4a-bf9e-e8a6a58930f3", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2928a6" }, body: JSON.stringify({ sessionId: "2928a6", location: "useConvert.ts:poll", message: "status", data: { state: s.state, progress: s.progress }, timestamp: Date.now(), hypothesisId: "C" }) }).catch(() => {});
              // #endregion
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
              // #region agent log
              fetch("http://127.0.0.1:7616/ingest/9f1d2e0e-b35a-4f4a-bf9e-e8a6a58930f3", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2928a6" }, body: JSON.stringify({ sessionId: "2928a6", location: "useConvert.ts:pollErr", message: "poll failed", data: { err: String(e) }, timestamp: Date.now(), hypothesisId: "D" }) }).catch(() => {});
              // #endregion
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
        // #region agent log
        fetch("http://127.0.0.1:7616/ingest/9f1d2e0e-b35a-4f4a-bf9e-e8a6a58930f3", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2928a6" }, body: JSON.stringify({ sessionId: "2928a6", location: "useConvert.ts:convertErr", message: "convert failed", data: { err: String(e) }, timestamp: Date.now(), hypothesisId: "E" }) }).catch(() => {});
        // #endregion
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
