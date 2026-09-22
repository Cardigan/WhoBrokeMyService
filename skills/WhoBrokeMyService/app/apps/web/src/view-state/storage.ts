import type { MindMapNode, MindMapViewState } from "../contracts/api";

const storagePrefix = "ai-mind-map:view-state:";

function storageKey(investigationKey: string): string {
  return `${storagePrefix}${investigationKey}`;
}

export function createInitialViewState(
  investigationKey: string,
  nodes: MindMapNode[],
): MindMapViewState {
  return {
    schemaVersion: 1,
    investigationKey,
    collapsedNodeIds: nodes
      .filter((node) => node.kind === "file" && !node.sourceEntityId.startsWith("02-hypotheses.md::"))
      .map((node) => node.id),
    eliminatedNodeIds: [],
  };
}

export function loadViewState(investigationKey: string, nodes: MindMapNode[]): MindMapViewState {
  const fallback = createInitialViewState(investigationKey, nodes);
  try {
    const raw = window.localStorage.getItem(storageKey(investigationKey));
    if (!raw) {
      return fallback;
    }
    const stored = JSON.parse(raw) as MindMapViewState;
    if (stored.schemaVersion !== 1 || stored.investigationKey !== investigationKey) {
      return fallback;
    }
    return mergeViewState(stored, nodes, fallback);
  } catch {
    return fallback;
  }
}

export function mergeViewState(
  state: MindMapViewState,
  nodes: MindMapNode[],
  fallback: MindMapViewState = createInitialViewState(state.investigationKey, nodes),
): MindMapViewState {
  const validIds = new Set(nodes.map((node) => node.id));
  return {
    schemaVersion: 1,
    investigationKey: state.investigationKey,
    collapsedNodeIds: state.collapsedNodeIds.filter((id) => validIds.has(id)),
    eliminatedNodeIds: (state.eliminatedNodeIds ?? []).filter((id) => validIds.has(id)),
    selectedNodeId: validIds.has(state.selectedNodeId ?? "") ? state.selectedNodeId : fallback.selectedNodeId,
  };
}

export function saveViewState(state: MindMapViewState): void {
  try {
    window.localStorage.setItem(storageKey(state.investigationKey), JSON.stringify(state));
  } catch {
    // Presentation persistence must never prevent the read-only viewer from working.
  }
}

export function clearViewState(investigationKey: string): void {
  try {
    window.localStorage.removeItem(storageKey(investigationKey));
  } catch {
    // Presentation persistence must never prevent the read-only viewer from working.
  }
}
