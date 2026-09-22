import { createHash } from "node:crypto";
import { normalize } from "node:path";
import type { InvestigationModel, MindMapProjection } from "@ai-mind-map/contracts";

const ROOT_NODE_ID = "investigation::root";

export function projectMindMap(model: InvestigationModel): MindMapProjection {
  const nodes: MindMapProjection["nodes"] = [
    {
      id: ROOT_NODE_ID,
      sourceEntityId: ROOT_NODE_ID,
      kind: "investigation",
      label: "Investigation",
      detailRef: { entityId: ROOT_NODE_ID }
    }
  ];
  const edges: MindMapProjection["edges"] = [];

  for (const document of model.documents) {
    nodes.push({
      id: document.id,
      sourceEntityId: document.id,
      kind: "file",
      label: document.title,
      parentId: ROOT_NODE_ID,
      detailRef: { entityId: document.id }
    });
    edges.push({
      id: `${ROOT_NODE_ID}::contains::${document.id}`,
      source: ROOT_NODE_ID,
      target: document.id,
      relation: "contains"
    });

    for (const item of document.items) {
      nodes.push({
        id: item.id,
        sourceEntityId: item.id,
        kind: "item",
        itemKind: item.kind,
        label: item.title,
        status: item.status,
        parentId: document.id,
        detailRef: { entityId: item.id }
      });
      edges.push({
        id: `${document.id}::contains::${item.id}`,
        source: document.id,
        target: item.id,
        relation: "contains"
      });
    }
  }

  return {
    schemaVersion: 1,
    investigationRevision: model.revision,
    investigationKey: investigationKeyFor(model),
    rootNodeId: ROOT_NODE_ID,
    nodes,
    edges
  };
}

function investigationKeyFor(model: InvestigationModel): string {
  const normalizedPath = normalize(model.rootPath).replace(/\\/g, "/");
  return createHash("sha256").update(normalizedPath).digest("hex");
}
