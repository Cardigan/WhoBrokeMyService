import { createHash } from "node:crypto";
import { readdir, readFile, realpath } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import type {
  EntityDetail,
  InvestigationDocument,
  InvestigationItem,
  InvestigationModel,
  ParseDiagnostic
} from "@ai-mind-map/contracts";
import { parseMarkdownFile } from "./markdown.js";
import { parseInvestigationDocument } from "./parser-registry.js";

export async function loadInvestigationModel(aiDirectory: string): Promise<InvestigationModel> {
  const rootPath = await realpath(aiDirectory);
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
  const diagnostics: ParseDiagnostic[] = [];
  const documents: InvestigationDocument[] = [];
  const revisionInput: string[] = [];

  for (const fileName of files) {
    const fullPath = resolve(rootPath, fileName);
    const relativePath = relative(rootPath, fullPath).replace(/\\/g, "/");
    try {
      const content = await readFile(fullPath, "utf8");
      revisionInput.push(`${relativePath}\0${content}`);
      const parsed = parseMarkdownFile(relativePath, content);
      documents.push(parseInvestigationDocument(parsed, diagnostics));
    } catch (error) {
      diagnostics.push({
        severity: "error",
        code: "parse-failed",
        message: `Could not parse ${fileName}: ${error instanceof Error ? error.message : String(error)}`,
        source: {
          relativePath,
          startLine: 1,
          endLine: 1
        }
      });
    }
  }

  if (files.length === 0) {
    diagnostics.push({
      severity: "warning",
      code: "empty-investigation",
      message: `${basename(rootPath)} contains no Markdown notes.`
    });
  }

  return {
    schemaVersion: 1,
    revision: createHash("sha256").update(revisionInput.join("\n---\n")).digest("hex").slice(0, 16),
    rootPath,
    generatedAt: new Date().toISOString(),
    documents,
    diagnostics
  };
}

export function getEntityDetail(model: InvestigationModel, entityId: string): EntityDetail | undefined {
  if (entityId === "investigation::root") {
    return {
      entity: {
        id: "investigation::root",
        kind: "investigation",
        title: basename(model.rootPath),
        documentCount: model.documents.length
      }
    };
  }

  for (const document of model.documents) {
    if (document.id === entityId) {
      return { entity: document, source: document.source };
    }
    const item = document.items.find((candidate) => candidate.id === entityId);
    if (item) {
      return { entity: item, source: item.source, markdown: item.markdown };
    }
  }

  return undefined;
}

export function isInvestigationItem(entity: EntityDetail["entity"]): entity is InvestigationItem {
  return "documentId" in entity;
}
