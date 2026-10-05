import { useCallback, useMemo, useRef, useState } from "react";
import { Copy, Download, FilePlus, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTranscribe } from "@/hooks/useTranscribe";
import {
  getTranscriptDownloadUrl,
  type TranscriptionLanguageId,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_MB = 100;
const ACCEPT = ".mp3,.wav,.m4a";
const ACCEPTED_EXTENSIONS = new Set(["mp3", "wav", "m4a"]);

const LANGUAGE_OPTIONS: { id: TranscriptionLanguageId; label: string }[] = [
  { id: "he", label: "Hebrew" },
  { id: "en", label: "English" },
];

function StepHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 mb-3 font-display text-xl font-bold text-foreground">
      {children}
    </h2>
  );
}

export function SpeechToTextPanel() {
  const { state, startTranscribe, reset } = useTranscribe();
  const [file, setFile] = useState<File | null>(null);
  const [languageId, setLanguageId] = useState<TranscriptionLanguageId>("he");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBusy = state.status === "submitting" || state.status === "polling";

  const acceptFile = useCallback((candidate: File) => {
    const ext = candidate.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      setUploadError("Please upload an .mp3, .wav, or .m4a file.");
      return;
    }
    if (candidate.size > MAX_MB * 1024 * 1024) {
      setUploadError(`File too large. Please upload a file under ${MAX_MB} MB.`);
      return;
    }
    setUploadError(null);
    setFile(candidate);
  }, []);

  const handleTranscribe = useCallback(() => {
    if (!file || isBusy) return;
    setCopied(false);
    void startTranscribe(file, languageId);
  }, [file, isBusy, languageId, startTranscribe]);

  const handleStartOver = useCallback(() => {
    reset();
    setFile(null);
    setUploadError(null);
    setCopied(false);
  }, [reset]);

  const transcript = state.status === "complete" ? state.transcript : null;
  const transcriptDir = transcript?.language_id === "he" ? "rtl" : "ltr";
  const jobIdForDownloads = state.status === "complete" ? state.jobId : null;

  const errorMessage =
    uploadError ?? (state.status === "failed" ? state.error : null);

  const progressLabel = useMemo(() => {
    if (state.status === "submitting") return "Uploading…";
    if (state.status === "polling") {
      if (state.state === "queued") return "Queued…";
      return `Transcribing… ${state.progress}%`;
    }
    return "";
  }, [state]);

  const handleCopy = useCallback(async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [transcript]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto pb-8 pr-1">
      {errorMessage && (
        <div className="w-full rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <p className="min-w-0 flex-1 text-sm text-destructive">{errorMessage}</p>
            <Button variant="outline" size="sm" className="shrink-0" onClick={handleStartOver}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* 1 · Upload */}
      <section aria-labelledby="stt-step-upload">
        <StepHeading>
          <span id="stt-step-upload">1 · Upload</span>
        </StepHeading>

        <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Audio language">
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = opt.id === languageId;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={isBusy}
                onClick={() => setLanguageId(opt.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-foreground hover:bg-muted"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div
          data-upload-zone
          role="button"
          tabIndex={0}
          aria-disabled={isBusy}
          className={cn(
            "flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-6 transition-colors",
            isDragging ? "border-primary bg-primary/10" : "border-border bg-neutral-50 dark:bg-neutral-900",
            isBusy && "cursor-not-allowed opacity-60"
          )}
          onClick={() => !isBusy && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isBusy) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBusy) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (isBusy) return;
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) acceptFile(dropped);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={isBusy}
            onChange={(e) => {
              const picked = e.target.files?.[0];
              e.target.value = "";
              if (picked) acceptFile(picked);
            }}
          />
          <div className="flex size-12 items-center justify-center rounded-lg bg-card text-foreground">
            <FilePlus className="size-6" strokeWidth={2} />
          </div>
          <p className="text-center text-sm font-bold text-foreground">
            {file ? file.name : "Drop audio or choose file"}
          </p>
          <p className="text-center text-sm text-muted-foreground">
            {file
              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              : `mp3 · wav · m4a · ${MAX_MB}MB`}
          </p>
        </div>

        <div className="mt-3 flex justify-end">
          <Button onClick={handleTranscribe} disabled={!file || isBusy}>
            Transcribe
          </Button>
        </div>
      </section>

      {/* 2 · Processing */}
      {isBusy && (
        <section aria-labelledby="stt-step-processing">
          <StepHeading>
            <span id="stt-step-processing">2 · Processing</span>
          </StepHeading>
          <p className="mb-2 text-sm font-medium text-muted-foreground">{progressLabel}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{
                width: `${state.status === "polling" ? state.progress : 0}%`,
              }}
            />
          </div>
        </section>
      )}

      {/* 3 · Transcript */}
      {transcript && (
        <section aria-labelledby="stt-step-result" className="flex min-h-0 flex-col">
          <StepHeading>
            <span id="stt-step-result">3 · Transcript</span>
          </StepHeading>

          <div className="mb-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="size-4" />
              {copied ? "Copied" : "Copy text"}
            </Button>
            {jobIdForDownloads && (
              <>
                <a
                  href={getTranscriptDownloadUrl(jobIdForDownloads, "txt")}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Download className="size-4" />
                  .txt
                </a>
                <a
                  href={getTranscriptDownloadUrl(jobIdForDownloads, "srt")}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Download className="size-4" />
                  .srt subtitles
                </a>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleStartOver}>
              <RotateCcw className="size-4" />
              Start over
            </Button>
          </div>

          {transcript.text ? (
            <div
              dir={transcriptDir}
              lang={transcript.language_id}
              className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-base leading-relaxed text-foreground"
            >
              {transcript.text}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No speech was detected in this file.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
