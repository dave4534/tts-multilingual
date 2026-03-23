import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { TextInput, MAX_WORDS, countWords } from "@/components/TextInput";
import { FileUpload } from "@/components/FileUpload";
import { VoiceSelector } from "@/components/VoiceSelector";
import { SelectedVoicePill } from "@/components/SelectedVoicePill";
import { LanguageSelector } from "@/components/LanguageSelector";
import { MobileVoiceBar } from "@/components/MobileVoiceBar";
import { VoiceSheet } from "@/components/VoiceSheet";
import { BottomBar } from "@/components/BottomBar";
import { Button } from "@/components/ui/button";
import { useVoices } from "@/hooks/useVoices";
import { useConvert } from "@/hooks/useConvert";
import { useTheme } from "@/hooks/useTheme";
import { ThemeToggleIcon } from "@/components/ThemeToggleIcon";
import {
  MAIN_PADDING_BOTTOM_IDLE_PX,
  MAIN_PADDING_BOTTOM_WITH_TEXT_PX,
  BOTTOM_BAR_HEIGHT_PX,
} from "@/lib/layout-constants";
import {
  DEFAULT_LANGUAGE_ID,
  getTextInputDir,
  getTextInputPlaceholder,
} from "@/lib/mtl-languages";
import {
  filterVoicesByLanguage,
  languageIdsWithUsableVoices,
  voiceSupportsLanguage,
} from "@/lib/voice-languages";

const NO_VOICES_FOR_LANGUAGE_MSG =
  "No voices for this language yet. Switch back to English or add a persona that supports this language.";

function App() {
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { voices, loading: voicesLoading, error: voicesError, refetch: refetchVoices } = useVoices();
  const { state: convertState, startConvert, reset } = useConvert();
  const { theme, toggleTheme } = useTheme();

  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [languageId, setLanguageId] = useState<string>(DEFAULT_LANGUAGE_ID);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [pendingVoiceId, setPendingVoiceId] = useState<string | null>(null);
  const clearConfirmDialogRef = useRef<HTMLDialogElement>(null);

  const voicesForLanguage = useMemo(
    () => filterVoicesByLanguage(voices, languageId),
    [voices, languageId]
  );

  const languagesWithVoices = useMemo(
    () => languageIdsWithUsableVoices(voices),
    [voices]
  );

  useEffect(() => {
    if (languagesWithVoices.length === 0) return;
    if (!languagesWithVoices.includes(languageId)) {
      setLanguageId(languagesWithVoices[0] ?? DEFAULT_LANGUAGE_ID);
    }
  }, [languagesWithVoices, languageId]);

  useEffect(() => {
    if (voices.length === 0) return;
    const pool = voicesForLanguage;
    const enabled = pool.filter(
      (v) => v.enabled !== false && !(v.enabled == null && !v.preview_url)
    );
    const firstEnabled = enabled[0]?.id ?? null;
    if (!voiceId) {
      setVoiceId(firstEnabled);
      return;
    }
    const current = pool.find((v) => v.id === voiceId);
    const currentDisabled =
      !current ||
      current.enabled === false ||
      (current.enabled == null && !current.preview_url);
    if (currentDisabled) {
      setVoiceId(firstEnabled);
    }
  }, [voices, voicesForLanguage, voiceId]);

  const canConvert =
    (text.trim().length > 0 || pendingFile) &&
    voiceId &&
    countWords(text) <= MAX_WORDS;

  const isConverting =
    convertState.status === "submitting" || convertState.status === "polling";

  const handleFileSelect = useCallback((file: File, extractedText: string) => {
    setPendingFile(file);
    setText(extractedText);
    setApiError(null);
  }, []);

  const handleConvert = useCallback(() => {
    if (!voiceId || !canConvert) return;
    setApiError(null);
    const input = pendingFile && text === "" ? pendingFile : text.trim();
    if (typeof input === "string" && !input) return;
    startConvert(input, voiceId, languageId);
  }, [voiceId, languageId, canConvert, pendingFile, text, startConvert]);

  const openVoiceSheet = useCallback(() => {
    setPendingVoiceId(voiceId);
    setVoiceSheetOpen(true);
    refetchVoices();
  }, [voiceId, refetchVoices]);

  const closeVoiceSheet = useCallback(() => {
    setVoiceSheetOpen(false);
  }, []);

  const performClear = useCallback(() => {
    reset();
    setText("");
    setPendingFile(null);
    setApiError(null);
  }, [reset]);

  const confirmVoiceSelection = useCallback(() => {
    if (!pendingVoiceId) {
      setVoiceSheetOpen(false);
      return;
    }
    const voice = voices.find((v) => v.id === pendingVoiceId);
    const allowedForLanguage =
      voice != null && voiceSupportsLanguage(voice, languageId);
    const voiceOk =
      allowedForLanguage &&
      voice.enabled !== false &&
      !(voice.enabled == null && !voice.preview_url);
    if (voiceOk) {
      setVoiceId(pendingVoiceId);
    }
    setVoiceSheetOpen(false);
  }, [pendingVoiceId, voices, languageId]);

  const selectedVoice = voices.find((v) => v.id === voiceId);
  const selectedVoiceIndex = selectedVoice
    ? voicesForLanguage.findIndex((v) => v.id === voiceId)
    : 0;

  const bottomBarStatus =
    convertState.status === "complete"
      ? "complete"
      : isConverting
        ? "converting"
        : "idle";

  const canRequestClear =
    bottomBarStatus === "complete" || text.trim().length > 0;

  const requestClear = useCallback(() => {
    if (!canRequestClear) return;
    clearConfirmDialogRef.current?.showModal();
  }, [canRequestClear]);

  const confirmClearAndCloseDialog = useCallback(() => {
    performClear();
    clearConfirmDialogRef.current?.close();
  }, [performClear]);

  const showFileUpload =
    bottomBarStatus === "idle" && text.trim().length === 0;

  const debugLayout = false; /* Set to true to show layout debug strips */
  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      {...(debugLayout ? { "data-debug-layout": "" } : {})}
    >
      <header className="relative shrink-0 flex h-[80px] items-center border-b border-border bg-neutral-50 dark:bg-sidebar" style={{ paddingLeft: 'var(--app-spacer-px)', paddingRight: 'var(--app-spacer-px)' }}>
        <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-1 text-foreground">
          <button
            type="button"
            onClick={requestClear}
            disabled={!canRequestClear}
            aria-label="Clear text and reset (opens confirmation)"
            className="m-0 cursor-pointer border-0 bg-transparent p-0 text-left font-display text-2xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar disabled:cursor-default disabled:opacity-100 disabled:hover:opacity-100 sm:text-xl"
          >
            Kol Me (Maybe)
          </button>
          <p className="text-sm text-muted-foreground">
            Transform your text into natural audio
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="absolute top-1/2 -translate-y-1/2 right-[var(--app-spacer-px)] p-1 text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
        <ThemeToggleIcon theme={theme} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col min-w-0">
          <div
            className="flex min-h-0 flex-1 flex-col min-w-0 relative"
            style={{ paddingTop: "var(--app-spacer-px)", paddingLeft: "var(--app-spacer-px)", paddingRight: "var(--app-spacer-px)" }}
          >
            {/* Layout debug strips – add data-debug-layout to root to show */}
            <div aria-hidden className="debug-strip-top absolute left-0 right-0 top-0 z-10 h-[25px]" />
            <div
              aria-hidden
              className="debug-strip-left absolute top-0 left-0 z-10 w-[25px]"
              style={{ bottom: `${BOTTOM_BAR_HEIGHT_PX}px` }}
            />
            <div
              aria-hidden
              className="debug-strip-right absolute right-0 top-0 z-10 w-[25px]"
              style={{ bottom: `${BOTTOM_BAR_HEIGHT_PX}px` }}
            />
            <div
              data-area="left-pane"
              className="debug-bg-left-pane relative z-0 flex min-h-0 flex-1 flex-col min-w-0"
            >
          <main
            className="flex min-h-[40vh] flex-1 flex-col overflow-hidden sm:min-h-0"
            style={{
              paddingTop: 0,
              paddingLeft: 0,
              paddingRight: 0,
              paddingBottom: showFileUpload
                ? `${MAIN_PADDING_BOTTOM_IDLE_PX}px`
                : `${MAIN_PADDING_BOTTOM_WITH_TEXT_PX}px`,
            }}
          >
            {(convertState.status === "failed" || apiError) && (
              <div className="mb-4 w-full rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="min-w-0 flex-1 text-sm text-destructive">
                    {convertState.status === "failed"
                      ? convertState.error
                      : apiError}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      if (convertState.status === "failed") reset();
                      setApiError(null);
                    }}
                  >
                    Try again
                  </Button>
                </div>
              </div>
            )}
            <section className="flex min-h-0 w-full flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between gap-3 max-sm:hidden">
                <div className="flex min-w-0 flex-1 items-center gap-3 pl-0">
                  {selectedVoice && (
                    <SelectedVoicePill
                      name={selectedVoice.name}
                      index={selectedVoiceIndex >= 0 ? selectedVoiceIndex : 0}
                    />
                  )}
                  {!voicesLoading &&
                    voicesForLanguage.length === 0 &&
                    !selectedVoice && (
                      <p className="min-w-0 max-w-[min(100%,20rem)] text-sm text-muted-foreground">
                        {NO_VOICES_FOR_LANGUAGE_MSG}
                      </p>
                    )}
                  <LanguageSelector
                    value={languageId}
                    onChange={setLanguageId}
                    availableLanguageIds={languagesWithVoices}
                    disabled={isConverting}
                    className="shrink-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={requestClear}
                  disabled={!canRequestClear}
                  className="shrink-0 rounded px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:underline disabled:pointer-events-none disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:hidden">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {selectedVoice ? (
                      <MobileVoiceBar
                        voiceName={selectedVoice.name}
                        voiceIndex={
                          selectedVoiceIndex >= 0 ? selectedVoiceIndex : 0
                        }
                        onChangeVoice={openVoiceSheet}
                        disabled={isConverting}
                      />
                    ) : voicesLoading ? (
                      <p className="text-sm text-muted-foreground px-1 py-3">
                        Loading voices…
                      </p>
                    ) : voicesForLanguage.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-1 py-3">
                        {NO_VOICES_FOR_LANGUAGE_MSG}
                      </p>
                    ) : null}
                  </div>
                  <LanguageSelector
                    value={languageId}
                    onChange={setLanguageId}
                    availableLanguageIds={languagesWithVoices}
                    disabled={isConverting}
                    className="min-w-[7.5rem] max-w-[9rem] shrink-0"
                  />
                </div>
                <div className="flex justify-end">
                <button
                  type="button"
                  onClick={requestClear}
                  disabled={!canRequestClear}
                  className="shrink-0 rounded px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:underline disabled:pointer-events-none disabled:opacity-50"
                >
                  Clear
                </button>
                </div>
              </div>

              {/* voice-text spacer: 40px gap between voice row and text input */}
              <div
                aria-hidden
                className="debug-spacer-voice-text shrink-0 self-stretch"
                style={{
                  height: 40,
                  width: "calc(100% + var(--app-spacer-px))",
                  marginRight: "calc(-1 * var(--app-spacer-px))",
                }}
              />

              {/* text-input area: distinct from left-pane for layout debug */}
              <div className="min-h-0 flex-1 flex flex-col min-w-0 bg-card">
                <TextInput
                  value={text}
                  onChange={setText}
                  placeholder={getTextInputPlaceholder(languageId)}
                  dir={getTextInputDir(languageId)}
                  lang={languageId}
                  disabled={isConverting}
                  className="w-full pl-0"
                  hasDragDropBelow={showFileUpload}
                />
              </div>
            </section>
          </main>
          </div>
          </div>
        </div>

        <aside className="hidden min-h-0 sm:flex w-full shrink-0 flex-col border-t border-border bg-neutral-50 dark:bg-sidebar sm:w-80 sm:border-l sm:border-t-0 lg:w-96">
          <div className="shrink-0 bg-neutral-50 dark:bg-sidebar py-3" style={{ paddingLeft: 'var(--app-spacer-px)', paddingRight: 'var(--app-spacer-px)' }}>
            <h2 className="m-0 font-sans text-sm font-semibold text-foreground">
              Choose a voice
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3" style={{ paddingLeft: 'var(--app-spacer-px)', paddingRight: 'var(--app-spacer-px)' }}>
            {voicesError && (
              <p className="mb-2 text-sm text-destructive">{voicesError}</p>
            )}
            <VoiceSelector
              voices={voicesForLanguage}
              selectedId={voiceId}
              onSelect={setVoiceId}
              loading={voicesLoading}
              disabled={isConverting}
              emptyLabel={NO_VOICES_FOR_LANGUAGE_MSG}
            />
          </div>
        </aside>
      </div>

      {showFileUpload ? (
        <>
          {/* footer spacer: 25px gap between content and bottom bar */}
          <div
            aria-hidden
            className="debug-spacer-footer fixed right-4 sm:right-[calc(20rem+25px)] lg:right-[calc(24rem+25px)]"
            style={{
              left: "var(--app-spacer-px)",
              bottom: BOTTOM_BAR_HEIGHT_PX,
              height: "25px",
            }}
          />
          <FileUpload
            onFileSelect={handleFileSelect}
            onError={setApiError}
            disabled={isConverting}
          />
        </>
      ) : (
        <div
          aria-hidden
          className="debug-spacer-footer fixed right-4 sm:right-[calc(20rem+25px)] lg:right-[calc(24rem+25px)]"
          style={{
            left: "var(--app-spacer-px)",
            bottom: BOTTOM_BAR_HEIGHT_PX,
            height: "25px",
          }}
        />
      )}

      <BottomBar
        status={bottomBarStatus}
        canConvert={!!canConvert}
        onConvert={handleConvert}
        progress={
          convertState.status === "polling" ? convertState.progress : 0
        }
        progressState={
          convertState.status === "polling" ? convertState.state : "queued"
        }
        downloadUrl={
          convertState.status === "complete" ? convertState.downloadUrl : undefined
        }
        wordCount={countWords(text)}
      />

      <VoiceSheet
        open={voiceSheetOpen}
        onClose={closeVoiceSheet}
        voices={voicesForLanguage}
        selectedId={pendingVoiceId ?? voiceId}
        onSelect={setPendingVoiceId}
        onConfirm={confirmVoiceSelection}
        loading={voicesLoading}
        disabled={isConverting}
      />

      {createPortal(
        <dialog
          ref={clearConfirmDialogRef}
          aria-labelledby="clear-confirm-title"
          className="fixed left-1/2 top-1/2 z-[200] m-0 w-[min(100vw-2rem,22rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-foreground shadow-xl [&::backdrop]:bg-black/50"
        >
          <h2 id="clear-confirm-title" className="m-0 font-sans text-lg font-semibold">
            Clear text?
          </h2>
          <p className="mt-2 mb-0 text-sm text-muted-foreground">
            Your changes will be lost.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <form method="dialog" className="contents">
              <Button type="submit" variant="outline" className="rounded-full">
                Keep editing
              </Button>
            </form>
            <Button
              type="button"
              variant="default"
              className="rounded-full"
              onClick={confirmClearAndCloseDialog}
            >
              Clear text
            </Button>
          </div>
        </dialog>,
        document.body,
      )}
    </div>
  );
}

export default App;
