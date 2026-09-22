import { describe, expect, it } from "vitest";
import { dagreMindMapLayout } from "./layout";
import type { MindMapProjection } from "../contracts/api";

const graph: MindMapProjection = {
  schemaVersion: 1,
  investigationRevision: "test",
  investigationKey: "test-investigation",
  rootNodeId: "root",
  nodes: [
    { id: "root", sourceEntityId: "root", kind: "investigation", label: "Root", detailRef: { entityId: "root" } },
    { id: "child", sourceEntityId: "child", kind: "file", label: "Child", parentId: "root", detailRef: { entityId: "child" } },
  ],
  edges: [{ id: "root-child", source: "root", target: "child", relation: "contains" }],
};

describe("dagreMindMapLayout", () => {
  it("lays out every visible node", () => {
    const positions = dagreMindMapLayout.layout(graph);

    expect(positions.root.x).toEqual(expect.any(Number));
    expect(positions.root.y).toEqual(expect.any(Number));
    expect(positions.child.x).toEqual(expect.any(Number));
    expect(positions.child.y).toEqual(expect.any(Number));
  });
});
