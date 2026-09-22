import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startMindMapServer, type RunningMindMapServer } from "./server.js";

const fixture = resolve(process.cwd(), "fixtures", "sanitized-investigation");
let server: RunningMindMapServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("local API", () => {
  it("serves model, projection, safe entity details, and editor metadata", async () => {
    server = await startMindMapServer({
      path: fixture,
      port: 0,
      editorUrlTemplate: "vscode://file/{path}:{line}"
    });

    const health = await fetch(`${server.url}/api/health`).then((response) => response.json());
    const projection = await fetch(`${server.url}/api/mind-map`).then((response) => response.json());
    const detail = await fetch(`${server.url}/api/entities/${encodeURIComponent("02-hypotheses.md::poc::poc-1")}`)
      .then((response) => response.json());
    const editor = await fetch(`${server.url}/api/open-editor`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityId: "02-hypotheses.md::poc::poc-1" })
    }).then((response) => response.json());

    expect(health.status).toBe("ok");
    expect(projection.nodes.some((node: { id: string }) => node.id === "02-hypotheses.md::poc::poc-1")).toBe(true);
    expect(detail.markdown).toContain("Cache invalidation");
    expect(editor).toMatchObject({ path: "02-hypotheses.md", line: 5 });
    expect(editor.url).toContain("02-hypotheses.md");
  });
});
