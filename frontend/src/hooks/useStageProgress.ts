import { useEffect, useState } from "react";
import { stageProgressFromElapsed } from "@/lib/stage-progress";

const TICK_MS = 100;

/** Elapsed-time synthetic progress while GPU/model warms up. Resets when `active` becomes false. */
export function useStageProgress(active: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return;
    }

    const startedAt = performance.now();
    setElapsedMs(0);

    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt);
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [active]);

  return stageProgressFromElapsed(elapsedMs);
}
