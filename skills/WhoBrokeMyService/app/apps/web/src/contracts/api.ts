import type { MindMapProjection } from "@ai-mind-map/contracts";

export type {
  DetailEntity,
  DiagnosticSeverity,
  DocumentKind,
  EntityDetail,
  InvestigationDocument,
  InvestigationEntity,
  InvestigationItem,
  InvestigationItemKind,
  InvestigationModel,
  InvestigationRootDetail,
  InvestigationStatus,
  MindMapEdge,
  MindMapNode,
  MindMapProjection,
  OutlineItem,
  ParseDiagnostic,
  SourceRange,
} from "@ai-mind-map/contracts";

/**
 * This optional bridge supports a concurrent backend rollout. Remove it once
 * `investigationKey` is added to the shared projection contract.
 */
export type MindMapSnapshot = MindMapProjection & {
  investigationKey?: string;
};

export interface MindMapEvent {
  type: "revision" | "diagnostics";
  revision?: string;
  diagnostics?: import("@ai-mind-map/contracts").ParseDiagnostic[];
}

export interface Point {
  x: number;
  y: number;
}

export interface MindMapViewState {
  schemaVersion: 1;
  investigationKey: string;
  collapsedNodeIds: string[];
  eliminatedNodeIds: string[];
  selectedNodeId?: string;
}
