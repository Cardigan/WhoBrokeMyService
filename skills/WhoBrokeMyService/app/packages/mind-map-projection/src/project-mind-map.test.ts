import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadInvestigationModel } from "@ai-mind-map/markdown-model";
import { projectMindMap } from "./project-mind-map.js";

describe("mind-map projection", () => {
  it("contains only the investigation, file, and semantic-item hierarchy", async () => {
    const model = await loadInvestigationModel(resolve(process.cwd(), "fixtures", "sanitized-investigation", ".ai"));
    const projection = projectMindMap(model);
    const refreshedProjection = projectMindMap({ ...model, revision: "new-revision" });
    const otherInvestigationProjection = projectMindMap({
      ...model,
      rootPath: `${model.rootPath}-other`
    });
    const hypothesisNode = projection.nodes.find((node) => node.id === "02-hypotheses.md::poc::poc-2");

    expect(projection.rootNodeId).toBe("investigation::root");
    expect(projection.investigationKey).toMatch(/^[a-f0-9]{64}$/);
    expect(refreshedProjection.investigationKey).toBe(projection.investigationKey);
    expect(otherInvestigationProjection.investigationKey).not.toBe(projection.investigationKey);
    expect(projection.investigationKey).not.toContain(model.rootPath);
    expect(projection.nodes).toHaveLength(1 + model.documents.length + model.documents.reduce((sum, document) => sum + document.items.length, 0));
    expect(projection.edges).toHaveLength(projection.nodes.length - 1);
    expect(projection.edges.every((edge) => edge.relation === "contains")).toBe(true);
    expect(hypothesisNode).toMatchObject({
      kind: "item",
      parentId: "02-hypotheses.md::file::root",
      itemKind: "poc"
    });
  });
});
