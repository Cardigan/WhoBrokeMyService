import type {
  DocumentKind,
  InvestigationDocument,
  InvestigationItem,
  InvestigationItemKind,
  InvestigationStatus,
  OutlineItem,
  ParseDiagnostic
} from "@ai-mind-map/contracts";
import { visit } from "unist-util-visit";
import { markdownText, sectionForHeading, sourceForNode, type ParsedMarkdownFile } from "./markdown.js";

export interface InvestigationDocumentParser {
  supports(relativePath: string): boolean;
  parse(input: ParsedMarkdownFile, diagnostics: ParseDiagnostic[]): InvestigationDocument;
}

type HeadingMatcher = (title: string) => InvestigationItemKind | undefined;

function normalizedKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function entityId(relativePath: string, kind: string, semanticKey: string): string {
  return `${relativePath}::${kind}::${semanticKey}`;
}

function inferStatus(value: string): InvestigationStatus | undefined {
  const normalized = value.toLowerCase();
  if (/\b(attention|blocked|failure|critical)\b/.test(normalized)) return "attention";
  if (/\b(refuted|rejected|busted|risky)\b/.test(normalized)) return "refuted";
  if (/\b(supported|verified|confirmed)\b/.test(normalized)) return "supported";
  if (/\b(superseded|obsolete)\b/.test(normalized)) return "superseded";
  if (/\b(active|untested|open)\b/.test(normalized)) return "active";
  return undefined;
}

function documentTitle(input: ParsedMarkdownFile): string {
  return input.headings.find((heading) => heading.depth === 1)?.title
    ?? input.relativePath.replace(/^\d+-/, "").replace(/\.md$/i, "");
}

function createBaseDocument(
  input: ParsedMarkdownFile,
  kind: DocumentKind,
  items: InvestigationItem[]
): InvestigationDocument {
  const documentId = entityId(input.relativePath, "file", "root");
  const keys = new Map<string, number>();
  const outline: OutlineItem[] = input.headings.map((heading) => {
    const baseKey = normalizedKey(heading.title);
    const count = (keys.get(baseKey) ?? 0) + 1;
    keys.set(baseKey, count);
    return {
      id: entityId(input.relativePath, "outline", count === 1 ? baseKey : `${baseKey}-${count}`),
      title: heading.title,
      level: heading.depth,
      source: {
        relativePath: input.relativePath,
        startLine: heading.startLine,
        endLine: heading.endLine
      }
    };
  });

  return {
    id: documentId,
    relativePath: input.relativePath,
    title: documentTitle(input),
    kind,
    outline,
    items
  ,
    source: input.source
  };
}

function itemsFromHeadings(
  input: ParsedMarkdownFile,
  kind: InvestigationItemKind,
  matcher: (title: string, headingIndex: number) => boolean,
  semanticKey: (title: string, index: number) => string = (title) => normalizedKey(title)
): InvestigationItem[] {
  const documentId = entityId(input.relativePath, "file", "root");
  const keys = new Map<string, number>();
  const items: InvestigationItem[] = [];

  input.headings.forEach((heading, index) => {
    if (heading.depth < 2 || !matcher(heading.title, index)) return;
    const section = sectionForHeading(input, index);
    const baseKey = semanticKey(heading.title, index);
    const count = (keys.get(baseKey) ?? 0) + 1;
    keys.set(baseKey, count);
    const key = count === 1 ? baseKey : `${baseKey}-${count}`;
    items.push({
      id: entityId(input.relativePath, kind, key),
      documentId,
      kind,
      title: heading.title,
      status: inferStatus(`${heading.title}\n${section.markdown}`),
      markdown: section.markdown,
      source: section.source,
      metadata: {
        semanticKey: key
      }
    });
  });

  return items;
}

function addListItems(
  input: ParsedMarkdownFile,
  kind: InvestigationItemKind,
  predicate: (node: { checked?: boolean | null }, text: string) => boolean,
  semanticPrefix: string
): InvestigationItem[] {
  const documentId = entityId(input.relativePath, "file", "root");
  const items: InvestigationItem[] = [];
  const keys = new Map<string, number>();

  visit(input.ast, "listItem", (node) => {
    const listItem = node as unknown as { checked?: boolean | null; children?: unknown[]; position?: unknown };
    const text = markdownText(listItem as Parameters<typeof markdownText>[0]).trim();
    if (!predicate(listItem, text)) return;
    const source = sourceForNode(
      input.relativePath,
      input.content,
      listItem as Parameters<typeof sourceForNode>[2]
    );
    if (!source) return;
    const explicit = text.match(/^(?:[A-Z]+)?(\d+)\s*[:.)-]/)?.[1];
    const baseKey = explicit ? `${semanticPrefix}-${explicit}` : normalizedKey(text);
    const count = (keys.get(baseKey) ?? 0) + 1;
    keys.set(baseKey, count);
    const key = count === 1 ? baseKey : `${baseKey}-${count}`;
    items.push({
      id: entityId(input.relativePath, kind, key),
      documentId,
      kind,
      title: text.replace(/^\[[ xX]\]\s*/, ""),
      status: inferStatus(text),
      markdown: source.markdown,
      source: source.source,
      metadata: {
        semanticKey: key,
        checked: listItem.checked ?? null
      }
    });
  });

  return items;
}

function addTableRowItems(
  input: ParsedMarkdownFile,
  kind: InvestigationItemKind,
  titleHeader: string,
  semanticPrefix: string
): InvestigationItem[] {
  const documentId = entityId(input.relativePath, "file", "root");
  const items: InvestigationItem[] = [];
  const keys = new Map<string, number>();

  visit(input.ast, "table", (node) => {
    const table = node as unknown as {
      children?: Array<{
        children?: Array<Parameters<typeof markdownText>[0]>;
        position?: unknown;
      }>;
    };
    const [header, ...rows] = table.children ?? [];
    const headers = (header?.children ?? []).map((cell) => markdownText(cell).trim().toLowerCase());
    const titleIndex = headers.indexOf(titleHeader.toLowerCase());
    if (titleIndex < 0) return;

    rows.forEach((row, rowIndex) => {
      const cells = (row.children ?? []).map((cell) => markdownText(cell).trim());
      const title = cells[titleIndex];
      if (!title) return;
      const source = sourceForNode(
        input.relativePath,
        input.content,
        row as Parameters<typeof sourceForNode>[2]
      );
      if (!source) return;

      const explicitKey = cells[0] && normalizedKey(cells[0]);
      const baseKey = explicitKey && explicitKey !== "item"
        ? `${semanticPrefix}-${explicitKey}`
        : `${semanticPrefix}-${normalizedKey(title) || rowIndex + 1}`;
      const count = (keys.get(baseKey) ?? 0) + 1;
      keys.set(baseKey, count);
      const key = count === 1 ? baseKey : `${baseKey}-${count}`;
      const metadata = Object.fromEntries(
        headers
          .map((headerName, index) => [normalizedKey(headerName), cells[index] ?? ""])
          .filter(([headerName]) => headerName !== "item")
      );

      items.push({
        id: entityId(input.relativePath, kind, key),
        documentId,
        kind,
        title,
        status: inferStatus(cells.join(" ")),
        markdown: source.markdown,
        source: source.source,
        metadata: {
          semanticKey: key,
          ...metadata
        }
      });
    });
  });

  return items;
}

function namedHeadingParser(
  fileName: string,
  kind: DocumentKind,
  matcher: HeadingMatcher
): InvestigationDocumentParser {
  return {
    supports: (relativePath) => relativePath.toLowerCase() === fileName,
    parse(input, diagnostics) {
      const items: InvestigationItem[] = [];
      input.headings.forEach((heading, index) => {
        if (heading.depth < 2) return;
        const itemKind = matcher(heading.title) ?? "section";
        const [item] = itemsFromHeadings(input, itemKind, (_, candidateIndex) => candidateIndex === index);
        if (item) items.push(item);
      });
      if (items.length === 0) {
        diagnostics.push(missingItemsDiagnostic(input, `${fileName} has no major headings.`));
      }
      return createBaseDocument(input, kind, items);
    }
  };
}

function missingItemsDiagnostic(input: ParsedMarkdownFile, message: string): ParseDiagnostic {
  return {
    severity: "warning",
    code: "missing-semantic-items",
    message,
    source: input.source
  };
}

const trackingParser = namedHeadingParser("00-tracking.md", "tracking", (title) =>
  /current (?:leading )?hypothesis|open loops?|open questions?/i.test(title) ? "section" : undefined
);

const initialFindingsParser = namedHeadingParser("01-initial-findings.md", "initial-findings", (title) =>
  /observation/i.test(title) ? "observation" : undefined
);

const rootCauseParser = namedHeadingParser("03-root-cause-analysis.md", "root-cause-analysis", () => "rca-section");

const traceParser = namedHeadingParser("04-trace-analysis.md", "trace-analysis", (title) =>
  /query/i.test(title) ? "query" : /observation/i.test(title) ? "observation" : undefined
);

const nextStepsParser: InvestigationDocumentParser = {
  supports: (relativePath) => relativePath.toLowerCase() === "05-next-steps.md",
  parse(input, diagnostics) {
    const headingActions = itemsFromHeadings(
      input,
      "action",
      (title) => /\b(action|test|step|next)\b/i.test(title)
    );
    const listActions = addListItems(
      input,
      "action",
      (node, text) => node.checked !== null && node.checked !== undefined || /^\s*(?:run|verify|review|collect|test|compare|deploy)\b/i.test(text),
      "action"
    );
    const tableActions = addTableRowItems(input, "action", "action", "action");
    const items = [...headingActions, ...listActions, ...tableActions];
    if (items.length === 0) diagnostics.push(missingItemsDiagnostic(input, "05-next-steps.md has no actions or tests."));
    return createBaseDocument(input, "next-steps", deduplicateItems(items));
  }
};

const assumptionsParser: InvestigationDocumentParser = {
  supports: (relativePath) => relativePath.toLowerCase() === "06-assumptions.md",
  parse(input, diagnostics) {
    const headingItems = itemsFromHeadings(input, "assumption", (title) => /^assumption\s+#?\w+/i.test(title));
    const listItems = addListItems(input, "assumption", () => true, "assumption");
    const tableItems = addTableRowItems(input, "assumption", "assumption", "assumption");
    const items = deduplicateItems([...headingItems, ...listItems, ...tableItems]);
    if (items.length === 0) diagnostics.push(missingItemsDiagnostic(input, "06-assumptions.md has no assumptions."));
    return createBaseDocument(input, "assumptions", items);
  }
};

const hypothesesParser: InvestigationDocumentParser = {
  supports: (relativePath) => relativePath.toLowerCase() === "02-hypotheses.md",
  parse(input, diagnostics) {
    const items = itemsFromHeadings(
      input,
      "poc",
      (title) => /(?:^|\b)(?:poc|hypothesis)\b/i.test(title),
      (title) => {
        const explicit = title.match(/\b(?:poc|hypothesis)\s*#?\s*([A-Za-z0-9._-]+)/i)?.[1];
        return explicit ? `poc-${normalizedKey(explicit)}` : normalizedKey(title);
      }
    ).map((item) => ({ ...item, status: item.status ?? "active" }));

    if (items.length === 0) {
      diagnostics.push(missingItemsDiagnostic(input, "02-hypotheses.md has no POC or hypothesis headings."));
    }
    return createBaseDocument(input, "hypotheses", items);
  }
};

const genericParser: InvestigationDocumentParser = {
  supports: () => true,
  parse(input, diagnostics) {
    const items = itemsFromHeadings(input, "section", () => true);
    if (items.length === 0 && input.content.trim()) {
      diagnostics.push(missingItemsDiagnostic(input, "Note has no level-two-or-deeper headings."));
    }
    return createBaseDocument(input, "note", items);
  }
};

function deduplicateItems(items: InvestigationItem[]): InvestigationItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function createParserRegistry(): InvestigationDocumentParser[] {
  return [
    trackingParser,
    initialFindingsParser,
    hypothesesParser,
    rootCauseParser,
    traceParser,
    nextStepsParser,
    assumptionsParser,
    genericParser
  ];
}

export function parseInvestigationDocument(
  input: ParsedMarkdownFile,
  diagnostics: ParseDiagnostic[],
  registry = createParserRegistry()
): InvestigationDocument {
  const parser = registry.find((candidate) => candidate.supports(input.relativePath));
  if (!parser) {
    throw new Error(`No Markdown parser registered for ${input.relativePath}`);
  }
  return parser.parse(input, diagnostics);
}
