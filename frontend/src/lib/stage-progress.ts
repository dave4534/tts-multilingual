/** Synthetic pre-generation progress (~45s total; 78% in first 7s). */
export const STAGE_PROGRESS_TOTAL_MS = 45_000;
export const STAGE_PROGRESS_FAST_MS = 7_000;
export const STAGE_PROGRESS_FAST_TARGET = 78;

export function stageProgressFromElapsed(elapsedMs: number): number {
  const t = Math.min(Math.max(elapsedMs, 0), STAGE_PROGRESS_TOTAL_MS);
  if (t <= STAGE_PROGRESS_FAST_MS) {
    return (STAGE_PROGRESS_FAST_TARGET * t) / STAGE_PROGRESS_FAST_MS;
  }
  const slowSpan = STAGE_PROGRESS_TOTAL_MS - STAGE_PROGRESS_FAST_MS;
  const slowPart = ((t - STAGE_PROGRESS_FAST_MS) / slowSpan) * (100 - STAGE_PROGRESS_FAST_TARGET);
  return STAGE_PROGRESS_FAST_TARGET + slowPart;
}

export function isPreGenerationPhase(state: string, backendProgress: number): boolean {
  return (
    state === "queued" ||
    state === "warming_up" ||
    (state === "processing" && backendProgress === 0)
  );
}
