import type { InvestigationItemKind, InvestigationStatus } from "./investigation-model.js";

export interface MindMapProjection {
  schemaVersion: 1;
  investigationRevision: string;
  investigationKey: string;
  rootNodeId: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export interface MindMapNode {
  id: string;
  sourceEntityId: string;
  kind: "investigation" | "file" | "item";
  itemKind?: InvestigationItemKind;
  label: string;
  status?: InvestigationStatus;
  parentId?: string;
  detailRef: {
    entityId: string;
  };
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  relation: "contains";
}
