import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { RotateCcw, Play, Pause, RotateCw } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onDurationChange = () => setDuration(el.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  const skip = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration, el.currentTime + delta));
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const t = Number(e.target.value);
    el.currentTime = t;
    setCurrentTime(t);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-3",
        className
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex w-full items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => skip(-10)}
          aria-label="Rewind 10 seconds"
          className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
        >
          <RotateCcw className="size-5" strokeWidth={2} />
          <span className="text-[10px] font-medium tabular-nums">10</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90"
        >
          {playing ? (
            <Pause className="size-5 fill-current" strokeWidth={0} />
          ) : (
            <Play className="size-5 fill-current ml-0.5" strokeWidth={0} />
          )}
        </button>
        <button
          type="button"
          onClick={() => skip(10)}
          aria-label="Forward 10 seconds"
          className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
        >
          <RotateCw className="size-5" strokeWidth={2} />
          <span className="text-[10px] font-medium tabular-nums">10</span>
        </button>
      </div>
      <div className="flex w-full flex-col gap-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={seek}
          className="h-1 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-moz-range-thumb]:bg-foreground"
          style={{
            background: `linear-gradient(to right, oklch(var(--foreground)) 0%, oklch(var(--foreground)) ${progressPercent}%, oklch(var(--muted-foreground)) ${progressPercent}%, oklch(var(--muted-foreground)) 100%)`,
          }}
        />
        <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
}
