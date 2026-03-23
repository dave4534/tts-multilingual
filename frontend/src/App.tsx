import { useState, useCallback, useEffect, useRef } from "react";
import { TextInput, MAX_WORDS, countWords } from "@/components/TextInput";
import { FileUpload } from "@/components/FileUpload";
import { VoiceSelector } from "@/components/VoiceSelector";
import { SelectedVoicePill } from "@/components/SelectedVoicePill";
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

function App() {
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { voices, loading: voicesLoading, error: voicesError, refetch: refetchVoices } = useVoices();
  const { state: convertState, startConvert, reset } = useConvert();
  const { theme, toggleTheme } = useTheme();

  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [pendingVoiceId, setPendingVoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (voices.length === 0) return;
    const enabled = voices.filter((v) => v.enabled !== false && !(v.enabled == null && !v.preview_url));
    const firstEnabled = enabled[0]?.id;
    if (!voiceId) {
      if (firstEnabled) setVoiceId(firstEnabled);
      return;
    }
    const current = voices.find((v) => v.id === voiceId);
    const currentDisabled = current?.enabled === false || (current?.enabled == null && !current?.preview_url);
    if (currentDisabled && firstEnabled) {
      setVoiceId(firstEnabled);
    }
  }, [voices, voiceId]);

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
    startConvert(input, voiceId);
  }, [voiceId, canConvert, pendingFile, text, startConvert]);

  const openVoiceSheet = useCallback(() => {
    setPendingVoiceId(voiceId);
    setVoiceSheetOpen(true);
    refetchVoices();
  }, [voiceId, refetchVoices]);

  const closeVoiceSheet = useCallback(() => {
    setVoiceSheetOpen(false);
  }, []);

  const handleClear = useCallback(() => {
    reset();
    setText("");
    setPendingFile(null);
    setApiError(null);
  }, [reset]);

  const confirmVoiceSelection = useCallback(() => {
    const voice = voices.find((v) => v.id === pendingVoiceId);
    const voiceOk = voice && voice.enabled !== false && !(voice.enabled == null && !voice.preview_url);
    if (pendingVoiceId && voiceOk) {
      setVoiceId(pendingVoiceId);
    }
    setVoiceSheetOpen(false);
  }, [pendingVoiceId, voices]);

  const selectedVoice = voices.find((v) => v.id === voiceId);
  const selectedVoiceIndex = selectedVoice
    ? voices.findIndex((v) => v.id === voiceId)
    : 0;

  const bottomBarStatus =
    convertState.status === "complete"
      ? "complete"
      : isConverting
        ? "converting"
        : "idle";

  const showFileUpload =
    bottomBarStatus === "idle" && text.trim().length === 0;

  const mainRef = useRef<HTMLElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const voiceRowRef = useRef<HTMLDivElement>(null);
  const textWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const log = (): void => {
      if (!mainRef.current || !sectionRef.current) return;
      const main = mainRef.current;
      const section = sectionRef.current;
      const mainRect = main.getBoundingClientRect();
      const uploadZone = document.querySelector("[data-upload-zone]");
      const footer = document.querySelector("footer[role='contentinfo']");
      const textWrapper = textWrapperRef.current;
      const payload = {
        mainPaddingTop: parseFloat(getComputedStyle(main).paddingTop),
        mainPaddingLeft: parseFloat(getComputedStyle(main).paddingLeft),
        mainPaddingRight: parseFloat(getComputedStyle(main).paddingRight),
        mainPaddingBottom: parseFloat(getComputedStyle(main).paddingBottom),
        sectionGap: parseFloat(getComputedStyle(section).gap),
        uploadZoneLeft: uploadZone ? (uploadZone as HTMLElement).getBoundingClientRect().left - mainRect.left : null,
        uploadZoneRight: uploadZone ? mainRect.right - (uploadZone as HTMLElement).getBoundingClientRect().right : null,
        footerTop: footer ? (footer as HTMLElement).getBoundingClientRect().top : null,
        uploadZoneBottom: uploadZone ? (uploadZone as HTMLElement).getBoundingClientRect().bottom : null,
        gapUploadToFooter: uploadZone && footer ? (footer as HTMLElement).getBoundingClientRect().top - (uploadZone as HTMLElement).getBoundingClientRect().bottom : null,
        textWrapperMarginRight: textWrapper ? parseFloat(getComputedStyle(textWrapper).marginRight) : null,
        showFileUpload,
      };
      fetch('http://127.0.0.1:7616/ingest/9f1d2e0e-b35a-4f4a-bf9e-e8a6a58930f3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'635054'},body:JSON.stringify({sessionId:'635054',location:'App.tsx:useEffect',message:'layout spacing',data:payload,hypothesisId:'H1,H2,H3,H4,H5',timestamp:Date.now()})}).catch(()=>{});
    };
    const t = setTimeout(log, 100);
    return () => clearTimeout(t);
  }, [showFileUpload]);

  const debugLayout = false; /* Set to true to show layout debug strips */
  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      {...(debugLayout ? { "data-debug-layout": "" } : {})}
    >
      <header className="relative shrink-0 flex h-[80px] items-center border-b border-border bg-neutral-50 dark:bg-sidebar" style={{ paddingLeft: 'var(--app-spacer-px)', paddingRight: 'var(--app-spacer-px)' }}>
        <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-1 text-foreground">
          <h1 className="m-0 font-display text-2xl font-bold tracking-tight sm:text-xl">
            Kol Me (Maybe)
          </h1>
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
            ref={mainRef}
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
            <section
              ref={sectionRef}
              className="flex min-h-0 w-full flex-1 flex-col"
            >
              <div ref={voiceRowRef} className="flex shrink-0 items-center justify-between gap-3 max-sm:hidden">
                <div className="flex items-center gap-3 pl-0">
                  {selectedVoice && (
                    <SelectedVoicePill
                      name={selectedVoice.name}
                      index={selectedVoiceIndex}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={bottomBarStatus !== "complete" && text.trim().length === 0}
                  className="shrink-0 rounded px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:underline disabled:pointer-events-none disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <div className="flex shrink-0 sm:hidden items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {selectedVoice && (
                    <MobileVoiceBar
                      voiceName={selectedVoice.name}
                      voiceIndex={selectedVoiceIndex}
                      onChangeVoice={openVoiceSheet}
                      disabled={isConverting}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={bottomBarStatus !== "complete" && text.trim().length === 0}
                  className="shrink-0 rounded px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:underline disabled:pointer-events-none disabled:opacity-50"
                >
                  Clear
                </button>
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
              <div
                ref={textWrapperRef}
                className="min-h-0 flex-1 flex flex-col min-w-0 bg-card"
              >
                <TextInput
                  value={text}
                  onChange={setText}
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

        <aside className="hidden sm:flex w-full shrink-0 flex-col border-t border-border bg-neutral-50 dark:bg-sidebar sm:w-80 sm:max-h-[calc(100vh-80px)] sm:border-l sm:border-t-0 sm:self-start lg:w-96 min-h-0">
          <div className="shrink-0 border-b border-border bg-neutral-50 dark:bg-sidebar py-3" style={{ paddingLeft: 'var(--app-spacer-px)', paddingRight: 'var(--app-spacer-px)' }}>
            <h2 className="text-sm font-semibold text-foreground">
              Choose a voice
            </h2>
          </div>
          <div className="max-h-[calc(100vh-128px)] overflow-y-auto overflow-x-hidden py-3" style={{ paddingLeft: 'var(--app-spacer-px)', paddingRight: 'var(--app-spacer-px)' }}>
            {voicesError && (
              <p className="mb-2 text-sm text-destructive">{voicesError}</p>
            )}
            <VoiceSelector
              voices={voices}
              selectedId={voiceId}
              onSelect={setVoiceId}
              loading={voicesLoading}
              disabled={isConverting}
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
        voices={voices}
        selectedId={pendingVoiceId ?? voiceId}
        onSelect={setPendingVoiceId}
        onConfirm={confirmVoiceSelection}
        loading={voicesLoading}
        disabled={isConverting}
      />
    </div>
  );
}

export default App;
