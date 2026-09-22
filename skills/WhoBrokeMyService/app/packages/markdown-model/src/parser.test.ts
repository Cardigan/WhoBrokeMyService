import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ParseDiagnostic } from "@ai-mind-map/contracts";
import { loadInvestigationModel } from "./loader.js";
import { parseMarkdownFile } from "./markdown.js";
import { parseInvestigationDocument } from "./parser-registry.js";

const fixture = resolve(process.cwd(), "fixtures", "sanitized-investigation", ".ai");

describe("Markdown investigation parser", () => {
  it("extracts one stable POC child per hypothesis heading with source ranges", async () => {
    const model = await loadInvestigationModel(fixture);
    const hypotheses = model.documents.find((document) => document.relativePath === "02-hypotheses.md");

    expect(hypotheses?.items.map((item) => item.id)).toEqual([
      "02-hypotheses.md::poc::poc-1",
      "02-hypotheses.md::poc::poc-2",
      "02-hypotheses.md::poc::poc-3"
    ]);
    expect(hypotheses?.items[0]).toMatchObject({
      title: "POC 1: Cache invalidation missed the tenant",
      source: { relativePath: "02-hypotheses.md", startLine: 5, endLine: 8 }
    });
    expect(hypotheses?.items[0].markdown).toContain("Expected evidence");
  });

  it("uses standard and generic parsers without crashing", async () => {
    const model = await loadInvestigationModel(fixture);

    expect(model.documents).toHaveLength(8);
    expect(model.documents.find((document) => document.relativePath === "05-next-steps.md")?.items)
      .toHaveLength(3);
    expect(model.documents.find((document) => document.relativePath === "06-assumptions.md")?.items)
      .toHaveLength(3);
    expect(model.documents.find((document) => document.relativePath === "07-known-facts.md")?.items)
      .toHaveLength(2);
    expect(model.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });

  it("extracts actions and assumptions from GFM tables used by real investigations", () => {
    const diagnostics: ParseDiagnostic[] = [];
    const nextSteps = parseInvestigationDocument(parseMarkdownFile(
      "05-next-steps.md",
      [
        "# Next Steps",
        "",
        "| # | Action | Detail | Status |",
        "|---|--------|--------|--------|",
        "| 1 | Compare live health | Check the failing and healthy controls | Pending |",
        "| 2 | Retry the rollout | Use the normal rolling path | Blocked |"
      ].join("\n")
    ), diagnostics);
    const assumptions = parseInvestigationDocument(parseMarkdownFile(
      "06-assumptions.md",
      [
        "# Assumptions",
        "",
        "| # | Assumption | Status | Risk if Wrong |",
        "|---|------------|--------|---------------|",
        "| 1 | The health signals are equivalent | 🟡 Assumed | High |",
        "| 2 | The rollout path is healthy | 🔴 Busted | Medium |"
      ].join("\n")
    ), diagnostics);

    expect(nextSteps.items.map((item) => item.title)).toEqual([
      "Compare live health",
      "Retry the rollout"
    ]);
    expect(assumptions.items.map((item) => item.title)).toEqual([
      "The health signals are equivalent",
      "The rollout path is healthy"
    ]);
    expect(assumptions.items[1]?.status).toBe("refuted");
    expect(diagnostics).toEqual([]);
  });
});
