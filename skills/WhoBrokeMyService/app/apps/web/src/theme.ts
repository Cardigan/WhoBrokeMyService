/**
 * Manual light/dark theme preference, layered on top of the automatic
 * `prefers-color-scheme` detection performed inline in `index.html`.
 *
 * The stored preference (if any) always wins over the OS preference once the
 * user has explicitly toggled it via the header theme button.
 */

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "ai-mind-map:theme";

export function loadTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (privacy mode, disabled storage, etc.).
  }

  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore persistence failures; the theme still applies for this session.
  }
}
