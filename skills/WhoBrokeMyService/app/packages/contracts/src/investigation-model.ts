export type DocumentKind =
  | "tracking"
  | "initial-findings"
  | "hypotheses"
  | "root-cause-analysis"
  | "trace-analysis"
  | "next-steps"
  | "assumptions"
  | "note";

export type InvestigationItemKind =
  | "section"
  | "poc"
  | "assumption"
  | "action"
  | "observation"
  | "query"
  | "rca-section";

export type InvestigationStatus =
  | "active"
  | "supported"
  | "refuted"
  | "superseded"
  | "attention";

export type DiagnosticSeverity = "warning" | "error";

export interface SourceRange {
  relativePath: string;
  startLine: number;
  endLine: number;
}

export interface ParseDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  source?: SourceRange;
}

export interface OutlineItem {
  id: string;
  title: string;
  level: number;
  source: SourceRange;
}

export interface InvestigationItem {
  id: string;
  documentId: string;
  kind: InvestigationItemKind;
  title: string;
  status?: InvestigationStatus;
  markdown: string;
  source: SourceRange;
  metadata: Record<string, string | number | boolean | null>;
}

export interface InvestigationDocument {
  id: string;
  relativePath: string;
  title: string;
  kind: DocumentKind;
  outline: OutlineItem[];
  items: InvestigationItem[];
  source: SourceRange;
}

export interface InvestigationModel {
  schemaVersion: 1;
  revision: string;
  rootPath: string;
  generatedAt: string;
  documents: InvestigationDocument[];
  diagnostics: ParseDiagnostic[];
}

export interface InvestigationRootDetail {
  id: "investigation::root";
  kind: "investigation";
  title: string;
  documentCount: number;
}

export type InvestigationEntity = InvestigationDocument | InvestigationItem;
export type DetailEntity = InvestigationRootDetail | InvestigationEntity;

export interface EntityDetail {
  entity: DetailEntity;
  source?: SourceRange;
  markdown?: string;
}
