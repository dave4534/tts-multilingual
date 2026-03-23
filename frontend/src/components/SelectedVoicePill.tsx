import { cn } from "@/lib/utils";

/* Voice persona circle colors – constant 300-shade palette (theme-independent) */
const AVATAR_COLORS = [
  "bg-blue-300",
  "bg-emerald-300",
  "bg-amber-300",
  "bg-rose-300",
  "bg-violet-300",
  "bg-teal-300",
  "bg-orange-300",
  "bg-pink-300",
  "bg-sky-300",
  "bg-fuchsia-300",
];

interface SelectedVoicePillProps {
  name: string;
  index: number;
  className?: string;
  fullWidth?: boolean;
}

export function SelectedVoicePill({
  name,
  index,
  className,
  fullWidth,
}: SelectedVoicePillProps) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div
      className={cn("inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-foreground", className)}
      role="status"
      aria-label={`Selected voice: ${name}`}
    >
      <div className={cn("size-4 shrink-0 rounded-full", color)} aria-hidden />
      <span className={cn("text-sm font-medium truncate", fullWidth ? "min-w-0 flex-1" : "max-w-[200px]")}>
        {name}
      </span>
    </div>
  );
}

export { AVATAR_COLORS };
