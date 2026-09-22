import { describe, expect, it } from "vitest";
import { createInitialViewState, mergeViewState } from "./storage";
import type { MindMapNode } from "../contracts/api";

const nodes: MindMapNode[] = [
  { id: "root", sourceEntityId: "root", kind: "investigation", label: "Root", detailRef: { entityId: "root" } },
  { id: "hypotheses", sourceEntityId: "02-hypotheses.md::file", kind: "file", label: "Hypotheses", parentId: "root", detailRef: { entityId: "hypotheses" } },
  { id: "next", sourceEntityId: "05-next-steps.md::file", kind: "file", label: "Next", parentId: "root", detailRef: { entityId: "next" } },
];

describe("view state", () => {
  it("expands hypotheses and collapses other file branches by default", () => {
    expect(createInitialViewState("investigation", nodes).collapsedNodeIds).toEqual(["next"]);
  });

  it("drops persisted state for removed nodes", () => {
    const state = {
      ...createInitialViewState("investigation", nodes),
      collapsedNodeIds: ["next", "removed"],
      eliminatedNodeIds: ["hypotheses", "removed"],
      selectedNodeId: "removed",
    };
    const merged = mergeViewState(state, nodes.slice(0, 2));

    expect(merged.collapsedNodeIds).toEqual([]);
    expect(merged.eliminatedNodeIds).toEqual(["hypotheses"]);
    expect(merged.selectedNodeId).toBeUndefined();
  });
});
