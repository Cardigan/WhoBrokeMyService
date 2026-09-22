import type {
  EntityDetail,
  InvestigationDocument,
  InvestigationItem,
  MindMapSnapshot,
  SourceRange,
} from "../contracts/api";

const rootId = "investigation::root" as const;
const trackingId = "00-tracking.md::file";
const hypothesesId = "02-hypotheses.md::file";
const pocOneId = "02-hypotheses.md::poc::1";
const pocTwoId = "02-hypotheses.md::poc::2";
const nextStepsId = "05-next-steps.md::file";
const actionId = "05-next-steps.md::action::review-evidence-files";

const range = (relativePath: string, startLine: number, endLine: number): SourceRange => ({
  relativePath,
  startLine,
  endLine,
});

const pocOne: InvestigationItem = {
  id: pocOneId,
  documentId: hypothesesId,
  kind: "poc",
  title: "POC 1: stale deployment",
  status: "active",
  markdown: "## POC 1: stale deployment\n\nThe current deployment may still reference an older package.\n\n```powershell\nGet-DeploymentVersion\n```\n\nReview the [rollout record](https://example.invalid/rollout) before treating this as supported.",
  source: range("02-hypotheses.md", 4, 14),
  metadata: {},
};

const pocTwo: InvestigationItem = {
  id: pocTwoId,
  documentId: hypothesesId,
  kind: "poc",
  title: "POC 2: unsupported claim",
  status: "refuted",
  markdown: "## POC 2: unsupported claim\n\nThis hypothesis was **refuted** by the collected evidence. Keep it visible for investigation history.",
  source: range("02-hypotheses.md", 16, 28),
  metadata: {},
};

const reviewEvidence: InvestigationItem = {
  id: actionId,
  documentId: nextStepsId,
  kind: "action",
  title: "Review evidence files",
  status: "supported",
  markdown: "## Review evidence files\n\nCompare the deployment record and incident timeline, then capture the result in the appropriate investigation note.",
  source: range("05-next-steps.md", 4, 10),
  metadata: {},
};

const tracking: InvestigationDocument = {
  id: trackingId,
  relativePath: "00-tracking.md",
  title: "00 Tracking",
  kind: "tracking",
  outline: [
    { id: "tracking-current", title: "Current hypothesis", level: 2, source: range("00-tracking.md", 4, 6) },
    { id: "tracking-open-loops", title: "Open loops", level: 2, source: range("00-tracking.md", 8, 14) },
  ],
  items: [],
  source: range("00-tracking.md", 1, 14),
};

const hypotheses: InvestigationDocument = {
  id: hypothesesId,
  relativePath: "02-hypotheses.md",
  title: "02 Hypotheses",
  kind: "hypotheses",
  outline: [
    { id: "hypotheses-poc-one", title: pocOne.title, level: 2, source: pocOne.source },
    { id: "hypotheses-poc-two", title: pocTwo.title, level: 2, source: pocTwo.source },
  ],
  items: [pocOne, pocTwo],
  source: range("02-hypotheses.md", 1, 28),
};

const nextSteps: InvestigationDocument = {
  id: nextStepsId,
  relativePath: "05-next-steps.md",
  title: "05 Next steps",
  kind: "next-steps",
  outline: [
    { id: "next-steps-review", title: reviewEvidence.title, level: 2, source: reviewEvidence.source },
  ],
  items: [reviewEvidence],
  source: range("05-next-steps.md", 1, 10),
};

export const devMindMapFixture: MindMapSnapshot = {
  schemaVersion: 1,
  investigationRevision: "dev-fixture",
  investigationKey: "dev-fixture",
  rootNodeId: rootId,
  nodes: [
    { id: rootId, sourceEntityId: rootId, kind: "investigation", label: "Demo investigation", detailRef: { entityId: rootId } },
    { id: trackingId, sourceEntityId: trackingId, kind: "file", label: "00 Tracking", parentId: rootId, detailRef: { entityId: trackingId } },
    { id: hypothesesId, sourceEntityId: hypothesesId, kind: "file", label: "02 Hypotheses", parentId: rootId, detailRef: { entityId: hypothesesId } },
    { id: pocOneId, sourceEntityId: pocOneId, kind: "item", itemKind: "poc", label: pocOne.title, status: pocOne.status, parentId: hypothesesId, detailRef: { entityId: pocOneId } },
    { id: pocTwoId, sourceEntityId: pocTwoId, kind: "item", itemKind: "poc", label: pocTwo.title, status: pocTwo.status, parentId: hypothesesId, detailRef: { entityId: pocTwoId } },
    { id: nextStepsId, sourceEntityId: nextStepsId, kind: "file", label: "05 Next steps", parentId: rootId, detailRef: { entityId: nextStepsId } },
    { id: actionId, sourceEntityId: actionId, kind: "item", itemKind: "action", label: reviewEvidence.title, status: reviewEvidence.status, parentId: nextStepsId, detailRef: { entityId: actionId } },
  ],
  edges: [
    { id: "root-tracking", source: rootId, target: trackingId, relation: "contains" },
    { id: "root-hypotheses", source: rootId, target: hypothesesId, relation: "contains" },
    { id: "hypotheses-poc-one", source: hypothesesId, target: pocOneId, relation: "contains" },
    { id: "hypotheses-poc-two", source: hypothesesId, target: pocTwoId, relation: "contains" },
    { id: "root-next-steps", source: rootId, target: nextStepsId, relation: "contains" },
    { id: "next-steps-action", source: nextStepsId, target: actionId, relation: "contains" },
  ],
};

const details: Record<string, EntityDetail> = {
  [rootId]: {
    entity: {
      id: rootId,
      kind: "investigation",
      title: "Demo investigation",
      documentCount: 3,
    },
  },
  [trackingId]: { entity: tracking, source: tracking.source },
  [hypothesesId]: { entity: hypotheses, source: hypotheses.source },
  [pocOneId]: { entity: pocOne, source: pocOne.source, markdown: pocOne.markdown },
  [pocTwoId]: { entity: pocTwo, source: pocTwo.source, markdown: pocTwo.markdown },
  [nextStepsId]: { entity: nextSteps, source: nextSteps.source },
  [actionId]: { entity: reviewEvidence, source: reviewEvidence.source, markdown: reviewEvidence.markdown },
};

export function getDevEntityDetail(id: string): EntityDetail {
  const detail = details[id];
  if (!detail) {
    throw new Error(`The fixture does not contain entity "${id}".`);
  }
  return detail;
}
