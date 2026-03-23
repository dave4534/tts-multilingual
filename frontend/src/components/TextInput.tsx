import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SCROLLBAR_WIDTH_PX, SCROLLBAR_THUMB_WIDTH_PX } from "@/lib/layout-constants";

const MAX_WORDS = 20_000;

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  hasDragDropBelow?: boolean;
  "data-testid"?: string;
}

export function TextInput({
  value,
  onChange,
  placeholder = "Paste your text here...",
  disabled,
  className,
  hasDragDropBelow = true,
  "data-testid": testId,
}: TextInputProps) {
  const wordCount = countWords(value);
  const overLimit = wordCount > MAX_WORDS;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);

  const updateScrollState = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    setScrollState({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    });
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, value]);

  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartScrollTop.current = textareaRef.current?.scrollTop ?? 0;
    },
    [disabled]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const el = textareaRef.current;
      if (!el) return;
      const dy = e.clientY - dragStartY.current;
      const trackHeight = el.clientHeight;
      const scrollableHeight = el.scrollHeight - el.clientHeight;
      if (scrollableHeight <= 0) return;
      const thumbHeight = Math.max(20, (trackHeight * trackHeight) / el.scrollHeight);
      const pixelsPerThumb = (trackHeight - thumbHeight) / scrollableHeight;
      const deltaScroll = dy / pixelsPerThumb;
      el.scrollTop = Math.max(
        0,
        Math.min(el.scrollHeight - el.clientHeight, dragStartScrollTop.current + deltaScroll)
      );
      dragStartY.current = e.clientY;
      dragStartScrollTop.current = el.scrollTop;
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const scrollable = scrollState.scrollHeight > scrollState.clientHeight;
  const trackHeight = scrollState.clientHeight;
  const thumbHeight = scrollable
    ? Math.max(20, (trackHeight * trackHeight) / scrollState.scrollHeight)
    : 0;
  const scrollableHeight = Math.max(0, scrollState.scrollHeight - scrollState.clientHeight);
  const thumbTop =
    scrollableHeight > 0
      ? (scrollState.scrollTop / scrollableHeight) * (trackHeight - thumbHeight)
      : 0;

  return (
    <div
      className={cn("relative flex min-h-0 flex-1 flex-col", className)}
    >
      <textarea
        ref={textareaRef}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ backgroundColor: "transparent" }}
        className={cn(
          "text-foreground dark:text-neutral-300",
          "w-full resize-none border-0 px-0 py-3 text-base transition-colors app-placeholder outline-none",
          "placeholder:opacity-70",
          "disabled:cursor-not-allowed disabled:opacity-60",
          hasDragDropBelow ? "absolute inset-0 h-full min-h-0 overflow-y-auto" : "min-h-0 flex-1",
          "scrollbar-none",
          "pr-[24px] lg:pr-[224px]",
          overLimit && "ring-2 ring-destructive ring-inset"
        )}
      />
      <div
        aria-hidden
        className="debug-scroll-track absolute top-0 right-0 flex shrink-0 flex-col items-center"
        style={{ width: SCROLLBAR_WIDTH_PX, bottom: 0 }}
      >
        <div className="relative w-full flex-1">
          {scrollable && (
            <div
              role="scrollbar"
              aria-valuenow={scrollState.scrollTop}
              aria-valuemin={0}
              aria-valuemax={scrollableHeight}
              className="absolute left-1/2 -translate-x-1/2 cursor-grab rounded-full active:cursor-grabbing bg-neutral-300 dark:bg-neutral-700"
              style={{
                width: SCROLLBAR_THUMB_WIDTH_PX,
                height: thumbHeight,
                top: thumbTop,
              }}
              onMouseDown={handleThumbMouseDown}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export { MAX_WORDS, countWords };
