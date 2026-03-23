import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "voicecraft-theme";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // #region agent log Theme apply (class + storage)
    fetch('http://127.0.0.1:7616/ingest/9f1d2e0e-b35a-4f4a-bf9e-e8a6a58930f3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f7dc5a'},body:JSON.stringify({sessionId:'f7dc5a',runId:'debug_theme_toggle',hypothesisId:'H1_H2_class_storage',location:'useTheme.ts:useEffect(theme)',message:'Applied theme classes + wrote localStorage',data:{theme,htmlClass:Array.from(document.documentElement.classList).join(' '),storage:localStorage.getItem(STORAGE_KEY)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [theme]);

  const setTheme = (next: Theme | ((prev: Theme) => Theme)) => {
    setThemeState((prev) => (typeof next === "function" ? next(prev) : next));
  };

  const toggleTheme = () => {
    // #region agent log Toggle invoked
    fetch(
      "http://127.0.0.1:7616/ingest/9f1d2e0e-b35a-4f4a-bf9e-e8a6a58930f3",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "f7dc5a",
        },
        body: JSON.stringify({
          sessionId: "f7dc5a",
          runId: "debug_theme_toggle",
          hypothesisId: "H0_toggle_invoked",
          location: "useTheme.ts:toggleTheme",
          message: "Theme toggle handler invoked",
          data: { fromTheme: theme },
          timestamp: Date.now(),
        }),
      }
    ).catch(() => {});
    // #endregion
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, setTheme, toggleTheme };
}
