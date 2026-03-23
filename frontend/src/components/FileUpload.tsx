import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FilePlus } from "lucide-react";
import { UPLOAD_ZONE_BOTTOM_PX } from "@/lib/layout-constants";
import { extractTextFromFile } from "@/lib/api";

const MAX_MB = 10;
const ACCEPT = ".txt,.pdf";

interface FileUploadProps {
  onFileSelect: (file: File, text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  className?: string;
  /** When true, renders in document flow instead of fixed overlay (prevents text overlap) */
  embedded?: boolean;
}

export function FileUpload({
  onFileSelect,
  onError,
  disabled,
  className,
  embedded = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_MB * 1024 * 1024) {
        onError(`File too large. Please upload a file under ${MAX_MB} MB.`);
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "txt" && ext !== "pdf") {
        onError("Please upload a .txt or .pdf file.");
        return;
      }

      if (ext === "txt") {
        const reader = new FileReader();
        reader.onload = () => {
          onFileSelect(file, reader.result as string);
        };
        reader.onerror = () => {
          onError("We couldn't read the file. Try pasting the text directly.");
        };
        reader.readAsText(file);
      } else {
        setIsExtracting(true);
        try {
          const { text } = await extractTextFromFile(file);
          onFileSelect(file, text);
        } catch {
          onError("We couldn't extract text from this PDF. Try pasting the text directly.");
        } finally {
          setIsExtracting(false);
        }
      }
    },
    [onFileSelect, onError]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      void processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled || isExtracting) return;
      const file = e.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [disabled, isExtracting, processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  return (
    <div
      data-upload-zone
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-6 transition-colors min-h-[220px]",
        "cursor-pointer hover:border-opacity-80",
        (disabled || isExtracting) && "cursor-not-allowed opacity-60",
        embedded
          ? "w-full shrink-0"
          : "fixed right-4 sm:right-[calc(20rem+25px)] lg:right-[calc(24rem+25px)]",
        isDragging ? "bg-primary/10 border-primary" : "bg-neutral-50 dark:bg-neutral-900 border-border",
        className
      )}
      style={{
        ...(embedded
          ? {}
          : {
              left: 'var(--app-spacer-px)',
              bottom: `${UPLOAD_ZONE_BOTTOM_PX}px`,
            }),
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && !isExtracting && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        disabled={disabled || isExtracting}
        className="hidden"
      />
      <div className="flex size-12 items-center justify-center rounded-lg bg-card text-foreground">
        <FilePlus className="size-6" strokeWidth={2} />
      </div>
      <p className="text-center text-sm font-bold text-foreground">
        {isExtracting ? "Extracting text..." : "Click to upload or drag and drop"}
      </p>
      <p className="text-center text-sm text-muted-foreground">
        {isExtracting ? "Please wait" : "Extract text via .txt or .pdf files of up to 10MB each"}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          or
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        disabled={disabled || isExtracting}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:opacity-90"
      >
        Choose file
      </button>
    </div>
  );
}
