import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number;
  state: string;
  className?: string;
}

const stateLabels: Record<string, string> = {
  queued: "Queued...",
  warming_up: "Warming up...",
  processing: "Converting...",
};

export function ProgressBar({ progress, state, className }: ProgressBarProps) {
  const label = stateLabels[state] ?? `Converting... ${progress}%`;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground">{label} {progress}%</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
