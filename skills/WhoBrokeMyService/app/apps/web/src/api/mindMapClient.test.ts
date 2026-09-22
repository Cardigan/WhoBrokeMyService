import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MindMapApiClient } from "./mindMapClient";

type MockListener = (event: Event) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  readonly listeners = new Map<string, MockListener[]>();
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: MockListener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {}

  emit(type: string, data: string): void {
    this.listeners.get(type)?.forEach((listener) => listener({ data } as MessageEvent<string>));
  }
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

describe("MindMapApiClient", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the shared EntityDetail wrapper without flattening its entity", async () => {
    const detail = {
      entity: {
        id: "02-hypotheses.md::file",
        relativePath: "02-hypotheses.md",
        title: "Hypotheses",
        kind: "hypotheses",
        outline: [],
        items: [],
        source: { relativePath: "02-hypotheses.md", startLine: 1, endLine: 2 },
      },
      source: { relativePath: "02-hypotheses.md", startLine: 1, endLine: 2 },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detail));
    vi.stubGlobal("fetch", fetchMock);

    const received = await new MindMapApiClient().getEntity(detail.entity.id);

    expect(received).toEqual(detail);
    expect(received.entity.kind).toBe("hypotheses");
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/entities/${encodeURIComponent(detail.entity.id)}`,
      expect.any(Object),
    );
  });

  it("normalizes named revision and diagnostics events", () => {
    const received: unknown[] = [];
    const disconnect = vi.fn();
    const unsubscribe = new MindMapApiClient().subscribe((event) => received.push(event), disconnect);
    const source = MockEventSource.instances[0];

    source.emit("revision", JSON.stringify({ revision: "rev-2" }));
    source.emit("diagnostics", JSON.stringify({
      revision: "rev-2",
      diagnostics: [{ severity: "warning", code: "empty-section", message: "Skipped an empty section." }],
    }));

    expect(received).toEqual([
      { type: "revision", revision: "rev-2", diagnostics: undefined },
      {
        type: "diagnostics",
        revision: "rev-2",
        diagnostics: [{ severity: "warning", code: "empty-section", message: "Skipped an empty section." }],
      },
    ]);
    expect(disconnect).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("posts the entity ID to the editor endpoint and opens its trusted URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      path: "02-hypotheses.md",
      line: 4,
      url: "vscode://file/02-hypotheses.md:4",
    }));
    const openMock = vi.fn().mockReturnValue({});
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("open", openMock);

    await new MindMapApiClient().openInEditor("02-hypotheses.md::poc::1");

    expect(fetchMock).toHaveBeenCalledWith("/api/open-editor", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ entityId: "02-hypotheses.md::poc::1" }),
    });
    expect(openMock).toHaveBeenCalledWith(
      "vscode://file/02-hypotheses.md:4",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
