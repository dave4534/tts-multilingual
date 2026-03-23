import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/AudioPlayer";
import { cn } from "@/lib/utils";
import { BOTTOM_BAR_HEIGHT_PX } from "@/lib/layout-constants";
import { Sparkles, Download } from "lucide-react";
import { useCallback, useState } from "react";

type BottomBarStatus = "idle" | "converting" | "complete";

interface BottomBarProps {
  status: BottomBarStatus;
  canConvert: boolean;
  onConvert: () => void;
  progress?: number;
  progressState?: string;
  downloadUrl?: string;
  wordCount?: number;
}

const MAX_WORDS = 20_000;

function isWarmingUp(progressState: string, progress: number): boolean {
  return (
    progressState === "queued" ||
    progressState === "warming_up" ||
    (progressState === "processing" && progress === 0)
  );
}

export function BottomBar({
  status,
  canConvert,
  onConvert,
  progress = 0,
  progressState = "queued",
  downloadUrl,
  wordCount = 0,
}: BottomBarProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!downloadUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "speech.mp3";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [downloadUrl]);

  const convertingLabel = isWarmingUp(progressState, progress)
    ? "Warming up"
    : `Generating ${progress}%`;

  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 flex shrink-0 items-center border-t border-border bg-neutral-50 dark:bg-sidebar right-0 sm:right-80 lg:right-96"
      )}
      style={{
        height: BOTTOM_BAR_HEIGHT_PX,
        minHeight: BOTTOM_BAR_HEIGHT_PX,
      }}
      role="contentinfo"
    >
      {status === "complete" && downloadUrl && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          aria-label="Download MP3"
          className="absolute top-6 right-6 shrink-0 p-1 text-muted-foreground transition-opacity hover:opacity-70 disabled:opacity-50"
        >
          <Download className="size-5" />
        </button>
      )}
      <div
        className={cn(
          "flex w-full items-center gap-4",
          status === "complete" ? "justify-center" : "justify-end"
        )}
        style={{ paddingLeft: 'var(--app-spacer-px)', paddingRight: 'var(--app-spacer-px)', paddingTop: 0, paddingBottom: 0 }}
      >
        {status === "idle" && (
          <>
            <p className="text-sm tabular-nums text-muted-foreground">
              {wordCount.toLocaleString()} / {MAX_WORDS.toLocaleString()} words
            </p>
            <Button
              size="lg"
              disabled={!canConvert}
              onClick={onConvert}
              className="h-9 min-w-[180px] rounded-full px-6 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="mr-2 size-4" />
              Generate Speech
            </Button>
          </>
        )}

        {status === "converting" && (
          <div
            role="status"
            aria-live="polite"
            aria-label={convertingLabel}
            className={cn(
              "relative flex h-9 min-w-[180px] shrink-0 items-center justify-center overflow-hidden rounded-full px-6 text-sm font-medium bg-muted text-muted-foreground"
            )}
          >
            <div
              className="absolute inset-y-0 left-0 bg-primary/20 transition-[width] duration-300 ease-out"
              style={{
                width: isWarmingUp(progressState, progress) ? "0%" : `${progress}%`,
              }}
            />
            <span className="relative z-10">{convertingLabel}</span>
          </div>
        )}

        {status === "complete" && downloadUrl && (
          <div className="flex w-[80%] max-w-full items-center gap-4">
            <AudioPlayer src={downloadUrl} className="min-w-0 flex-1" />
          </div>
        )}
      </div>
    </footer>
  );
}
