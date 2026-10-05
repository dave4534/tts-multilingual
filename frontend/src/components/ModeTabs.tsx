import { cn } from "@/lib/utils";

export type AppMode = "tts" | "stt";

interface ModeTabsProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
  disabled?: boolean;
}

const TABS: { id: AppMode; label: string }[] = [
  { id: "tts", label: "Text → Speech" },
  { id: "stt", label: "Speech → Text" },
];

export function ModeTabs({ mode, onChange, disabled }: ModeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Choose a tool"
      className="flex shrink-0 flex-wrap gap-3 pb-4"
    >
      {TABS.map((tab) => {
        const active = tab.id === mode;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled && !active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-xl border-2 px-4 py-2 font-display text-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-dashed border-foreground/60 bg-transparent text-foreground hover:border-foreground"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
