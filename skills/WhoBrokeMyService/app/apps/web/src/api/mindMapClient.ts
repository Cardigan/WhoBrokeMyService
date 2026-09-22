import type { EntityDetail, MindMapEvent, MindMapSnapshot } from "../contracts/api";

export type DataSource = "live" | "fixture";

export interface MindMapLoadResult {
  snapshot: MindMapSnapshot;
  source: DataSource;
}

interface SsePayload {
  revision?: string;
  diagnostics?: import("@ai-mind-map/contracts").ParseDiagnostic[];
}

export interface OpenEditorResult {
  path: string;
  line: number;
  url?: string;
}

export interface SelectFolderResult {
  path: string | null;
  cancelled: boolean;
}

export interface InvestigationLocation {
  projectRoot: string;
  aiDirectory: string;
}

export interface HealthStatus {
  status: string;
  host: string;
  watchedPath: string;
  projectRoot?: string;
}

export function normalizeSseEvent(
  type: MindMapEvent["type"],
  data: string,
): MindMapEvent {
  const payload = JSON.parse(data) as SsePayload;
  return {
    type,
    revision: payload.revision,
    diagnostics: payload.diagnostics,
  };
}

export class MindMapApiClient {
  private usingFixture = false;

  async getMindMap(): Promise<MindMapLoadResult> {
    try {
      const response = await fetch("/api/mind-map", { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`Mind map request failed (${response.status}).`);
      }
      this.usingFixture = false;
      return { snapshot: await response.json() as MindMapSnapshot, source: "live" };
    } catch (error) {
      if (!import.meta.env.DEV) {
        throw error;
      }
      this.usingFixture = true;
      const { devMindMapFixture } = await import("./devFixture");
      return { snapshot: devMindMapFixture, source: "fixture" };
    }
  }

  async getEntity(id: string): Promise<EntityDetail> {
    if (this.usingFixture) {
      const { getDevEntityDetail } = await import("./devFixture");
      return getDevEntityDetail(id);
    }

    const response = await fetch(`/api/entities/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Entity request failed (${response.status}).`);
    }
    return response.json() as Promise<EntityDetail>;
  }

  subscribe(onEvent: (event: MindMapEvent) => void, onDisconnected: () => void): () => void {
    if (this.usingFixture) {
      onDisconnected();
      return () => undefined;
    }

    const handleEvent = (type: MindMapEvent["type"], event: Event) => {
      try {
        onEvent(normalizeSseEvent(type, (event as MessageEvent<string>).data));
      } catch {
        onEvent({
          type: "diagnostics",
          diagnostics: [{
            severity: "warning",
            code: "invalid-sse-payload",
            message: "Received an unreadable server event.",
          }],
        });
      }
    };
    const source = new EventSource("/api/events");
    source.addEventListener("revision", (event) => handleEvent("revision", event));
    source.addEventListener("diagnostics", (event) => handleEvent("diagnostics", event));
    source.onerror = onDisconnected;
    return () => source.close();
  }

  async openInEditor(entityId: string): Promise<OpenEditorResult> {
    if (this.usingFixture) {
      throw new Error("The development fixture cannot open an editor.");
    }
    const response = await fetch("/api/open-editor", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ entityId }),
    });
    if (!response.ok) {
      throw new Error("The editor endpoint is unavailable.");
    }
    const result = await response.json() as OpenEditorResult;
    if (!result.url) {
      throw new Error("The editor endpoint did not return a launch URL.");
    }
    const editorWindow = window.open(result.url, "_blank", "noopener,noreferrer");
    if (!editorWindow) {
      window.location.assign(result.url);
    }
    return result;
  }

  async getHealth(): Promise<HealthStatus | undefined> {
    if (this.usingFixture) {
      return undefined;
    }
    try {
      const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
      if (!response.ok) {
        return undefined;
      }
      return response.json() as Promise<HealthStatus>;
    } catch {
      return undefined;
    }
  }

  async selectSourceFolder(initialPath?: string): Promise<SelectFolderResult> {
    const response = await fetch("/api/select-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ initialPath }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
      throw new Error(body?.error ?? "Could not open the folder picker.");
    }
    return response.json() as Promise<SelectFolderResult>;
  }

  async loadSource(path: string): Promise<InvestigationLocation> {
    const response = await fetch("/api/load-source", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
      throw new Error(body?.error ?? `Could not load "${path}".`);
    }
    const result = await response.json() as { location: InvestigationLocation };
    this.usingFixture = false;
    return result.location;
  }
}
