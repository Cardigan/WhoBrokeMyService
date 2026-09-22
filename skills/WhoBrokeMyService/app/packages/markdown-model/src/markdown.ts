import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { Root } from "mdast";
import type { SourceRange } from "@ai-mind-map/contracts";

export interface MarkdownHeading {
  title: string;
  depth: number;
  startOffset: number;
  startLine: number;
  endLine: number;
}

export interface ParsedMarkdownFile {
  relativePath: string;
  content: string;
  ast: Root;
  headings: MarkdownHeading[];
  source: SourceRange;
}

type MarkdownNode = {
  type?: string;
  value?: string;
  children?: MarkdownNode[];
  position?: {
    start: { line: number; offset?: number };
    end: { line: number; offset?: number };
  };
};

export function parseMarkdownFile(relativePath: string, content: string): ParsedMarkdownFile {
  const ast = unified().use(remarkParse).use(remarkGfm).parse(content) as Root;
  const headings = ((ast.children ?? []) as MarkdownNode[])
    .filter((node) => node.type === "heading" && node.position)
    .map((node) => ({
      title: markdownText(node).trim(),
      depth: Number((node as MarkdownNode & { depth?: number }).depth ?? 1),
      startOffset: node.position?.start.offset ?? 0,
      startLine: node.position?.start.line ?? 1,
      endLine: node.position?.end.line ?? 1
    }));

  return {
    relativePath,
    content,
    ast,
    headings,
    source: {
      relativePath,
      startLine: 1,
      endLine: lineCount(content)
    }
  };
}

export function markdownText(node: MarkdownNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }

  return (node.children ?? []).map(markdownText).join("");
}

export function lineCount(content: string): number {
  return Math.max(1, content.split(/\r?\n/).length);
}

export function sectionForHeading(
  input: ParsedMarkdownFile,
  headingIndex: number
): { markdown: string; source: SourceRange } {
  const heading = input.headings[headingIndex];
  const next = input.headings
    .slice(headingIndex + 1)
    .find((candidate) => candidate.depth <= heading.depth);
  const endOffset = next?.startOffset ?? input.content.length;
  const endLine = next ? Math.max(heading.startLine, next.startLine - 1) : lineCount(input.content);

  return {
    markdown: input.content.slice(heading.startOffset, endOffset),
    source: {
      relativePath: input.relativePath,
      startLine: heading.startLine,
      endLine
    }
  };
}

export function sourceForNode(
  relativePath: string,
  content: string,
  node: MarkdownNode
): { markdown: string; source: SourceRange } | undefined {
  const start = node.position?.start;
  const end = node.position?.end;
  if (!start || !end || start.offset === undefined || end.offset === undefined) {
    return undefined;
  }

  return {
    markdown: content.slice(start.offset, end.offset),
    source: {
      relativePath,
      startLine: start.line,
      endLine: end.line
    }
  };
}
