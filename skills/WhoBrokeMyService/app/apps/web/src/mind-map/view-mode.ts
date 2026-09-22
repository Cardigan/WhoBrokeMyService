const storageKey = "ai-mind-map:view-mode";

export type MindMapViewMode = "graph" | "radial";

export function loadViewMode(): MindMapViewMode {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === "radial" ? "radial" : "graph";
  } catch {
    return "graph";
  }
}

export function saveViewMode(mode: MindMapViewMode): void {
  try {
    window.localStorage.setItem(storageKey, mode);
  } catch {
    // Presentation persistence must never prevent the read-only viewer from working.
  }
}
