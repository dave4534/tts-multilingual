import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_LANGUAGE_ID, getMtlLanguageLabel } from "@/lib/mtl-languages";
import { VOICE_PILL_CHROME_CLASS } from "@/components/SelectedVoicePill";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  value: string;
  onChange: (languageId: string) => void;
  /** BCP-47-ish codes that have at least one usable voice reference (e.g. from manifest). */
  availableLanguageIds: readonly string[];
  disabled?: boolean;
  className?: string;
}

export function LanguageSelector({
  value,
  onChange,
  availableLanguageIds,
  disabled,
  className,
}: LanguageSelectorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const allowed = new Set(
    availableLanguageIds.length > 0 ? availableLanguageIds : [DEFAULT_LANGUAGE_ID]
  );
  const safeId = allowed.has(value) ? value : [...allowed][0] ?? DEFAULT_LANGUAGE_ID;
  const label = getMtlLanguageLabel(safeId);

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              VOICE_PILL_CHROME_CLASS,
              "min-w-[9rem] max-w-[min(100%,12rem)] shrink-0 text-left transition-colors",
              "outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:pointer-events-none disabled:opacity-50 aria-expanded:opacity-90",
              className
            )}
            aria-label={`Output language: ${label}. Open menu to change.`}
          />
        }
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[min(24rem,70vh)] w-56 overflow-y-auto">
        {/* Base UI: GroupLabel / radio items must live inside Menu.Group */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Output language</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={safeId}
            onValueChange={(next: unknown) => {
              if (typeof next === "string" && next.length > 0 && allowed.has(next)) {
                onChange(next);
                setMenuOpen(false);
              }
            }}
          >
            {[...allowed].map((id) => (
              <DropdownMenuRadioItem key={id} value={id}>
                {getMtlLanguageLabel(id)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
