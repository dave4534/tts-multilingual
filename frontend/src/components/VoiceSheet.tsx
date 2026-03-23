import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { VoiceSelector } from "@/components/VoiceSelector";
import { Button } from "@/components/ui/button";
import type { Voice } from "@/lib/api";

interface VoiceSheetProps {
  open: boolean;
  onClose: () => void;
  voices: Voice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function VoiceSheet({
  open,
  onClose,
  voices,
  selectedId,
  onSelect,
  onConfirm,
  loading,
  disabled,
}: VoiceSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-foreground/50 transition-opacity"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-sheet-title"
        className={cn(
          "fixed inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-border bg-neutral-50 dark:bg-sidebar shadow-xl transition-transform duration-200 ease-out"
        )}
        style={{ zIndex: "var(--z-modal)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 id="voice-sheet-title" className="text-base font-semibold text-foreground">
            Choose a voice
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:opacity-80"
          >
            Cancel
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-safe">
          <VoiceSelector
            voices={voices}
            selectedId={selectedId}
            onSelect={onSelect}
            loading={loading}
            disabled={disabled}
            className="gap-3"
          />
        </div>
        <div className="shrink-0 border-t border-border p-4 pb-safe">
          <Button
            onClick={onConfirm}
            disabled={!selectedId || disabled || (() => {
          const v = voices.find((x) => x.id === selectedId);
          return !v || v.enabled === false || (v.enabled == null && !v.preview_url);
        })()}
            className="w-full rounded-full bg-primary py-6 text-base font-medium text-primary-foreground hover:bg-primary/90"
          >
            Select
          </Button>
        </div>
      </div>
    </>
  );
}
