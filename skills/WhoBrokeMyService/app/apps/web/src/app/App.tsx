import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MindMapApiClient, type DataSource } from "../api/mindMapClient";
import type {
  EntityDetail,
  MindMapNode,
  MindMapSnapshot,
  MindMapViewState,
  ParseDiagnostic,
} from "../contracts/api";
import { NodeDetailPane } from "../detail-panel/NodeDetailPane";
import { RadialTreeMindMap } from "../mind-map/radial/RadialTreeMindMap";
import { ReactFlowMindMap } from "../mind-map/react-flow/ReactFlowMindMap";
import { loadViewMode, saveViewMode, type MindMapViewMode } from "../mind-map/view-mode";
import { applyTheme, loadTheme, type ThemeMode } from "../theme";
import { loadViewState, mergeViewState, saveViewState, clearViewState } from "../view-state/storage";

type ConnectionState = "connecting" | "connected" | "disconnected" | "fixture";

const viewModeOptions: Array<{ value: MindMapViewMode; label: string }> = [
  { value: "graph", label: "Mind map" },
  { value: "radial", label: "Radial tree" },
];

const LAST_FOLDER_STORAGE_KEY = "mindmap:lastFolder";

function loadLastFolder(): string | undefined {
  try {
    return window.localStorage.getItem(LAST_FOLDER_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveLastFolder(path: string): void {
  try {
    window.localStorage.setItem(LAST_FOLDER_STORAGE_KEY, path);
  } catch {
    // Ignore storage failures (e.g. private browsing quota errors).
  }
}

function truncatePathForDisplay(path: string, segmentsToShow = 3): string {
  const normalized = path.replace(/\\/g, "/");
  const hasTrailingSlash = normalized.endsWith("/") && normalized.length > 1;
  const trimmed = hasTrailingSlash ? normalized.slice(0, -1) : normalized;
  const segments = trimmed.split("/").filter((segment) => segment.length > 0);

  if (segments.length <= segmentsToShow) {
    return path;
  }

  const visible = segments.slice(-segmentsToShow);
  return `.../${visible.join("/")}`;
}

function getInvestigationKey(snapshot: MindMapSnapshot): string {
  return snapshot.investigationKey
    ?? snapshot.nodes.find((node) => node.id === snapshot.rootNodeId)?.sourceEntityId
    ?? snapshot.rootNodeId;
}

function getEntityNodeId(entityId: string, nodes: MindMapNode[]): string | undefined {
  return nodes.find((node) => node.detailRef.entityId === entityId || node.sourceEntityId === entityId)?.id;
}

function getAncestorChain(nodeId: string, nodes: MindMapNode[]): MindMapNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const chain: MindMapNode[] = [];
  let current = byId.get(nodeId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

export function App() {
  const client = useMemo(() => new MindMapApiClient(), []);
  const [snapshot, setSnapshot] = useState<MindMapSnapshot>();
  const [source, setSource] = useState<DataSource>();
  const [loadError, setLoadError] = useState<string>();
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [diagnostics, setDiagnostics] = useState<ParseDiagnostic[]>([]);
  const [viewState, setViewState] = useState<MindMapViewState>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [details, setDetails] = useState<Record<string, EntityDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();
  const [selectionNotice, setSelectionNotice] = useState<string>();
  const [mapWidth, setMapWidth] = useState(65);
  const [viewMode, setViewMode] = useState<MindMapViewMode>(() => loadViewMode());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string>();
  const [activePath, setActivePath] = useState<string>();
  const workspaceRef = useRef<HTMLElement>(null);
  const previousSnapshotRef = useRef<MindMapSnapshot | undefined>(undefined);

  useEffect(() => {
    saveViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const loadMap = useCallback(async () => {
    setLoadError(undefined);
    try {
      const result = await client.getMindMap();
      setSnapshot(result.snapshot);
      setSource(result.source);
      setConnection(result.source === "live" ? "connected" : "fixture");
      setDiagnostics([]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the mind map.");
      setConnection("disconnected");
    }
  }, [client]);

  useEffect(() => {
    void loadMap();
  }, [loadMap]);

  useEffect(() => {
    void client.getHealth().then((health) => {
      if (health) {
        setActivePath(health.projectRoot ?? health.watchedPath);
      }
    });
  }, [client]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const investigationKey = getInvestigationKey(snapshot);
    setViewState((current) => {
      const next = current?.investigationKey === investigationKey
        ? mergeViewState(current, snapshot.nodes)
        : loadViewState(investigationKey, snapshot.nodes);
      return next;
    });

    const validIds = new Set(snapshot.nodes.map((node) => node.id));
    setSelectedNodeId((current) => {
      if (current && validIds.has(current)) {
        return current;
      }
      if (current) {
        const priorNode = previousSnapshotRef.current?.nodes.find((node) => node.id === current);
        const fallback = priorNode?.parentId && validIds.has(priorNode.parentId)
          ? priorNode.parentId
          : snapshot.rootNodeId;
        setSelectionNotice("The selected item changed. Showing its nearest available parent.");
        return fallback;
      }
      return snapshot.rootNodeId;
    });
    previousSnapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (viewState) {
      saveViewState(viewState);
    }
  }, [viewState]);

  useEffect(() => {
    if (!snapshot || !selectedNodeId) {
      return;
    }
    const entityId = snapshot.nodes.find((node) => node.id === selectedNodeId)?.detailRef.entityId;
    if (!entityId) {
      return;
    }
    const cached = details[entityId];
    if (cached) {
      setDetailError(undefined);
      setDetailLoading(false);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError(undefined);
    void client.getEntity(entityId).then(
      (detail) => {
        if (active) {
          setDetails((current) => ({ ...current, [entityId]: detail }));
          setDetailLoading(false);
        }
      },
      (error: unknown) => {
        if (active) {
          setDetailError(error instanceof Error ? error.message : "Could not load selected source.");
          setDetailLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [client, details, selectedNodeId, snapshot]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    return client.subscribe(
      (event) => {
        setConnection("connected");
        if (event.diagnostics) {
          setDiagnostics(event.diagnostics);
        }
        if (event.type === "revision") {
          void loadMap();
        }
      },
      () => setConnection("disconnected"),
    );
  }, [client, loadMap, snapshot?.investigationRevision]);

  const updateViewState = useCallback((update: (state: MindMapViewState) => MindMapViewState) => {
    setViewState((current) => current ? update(current) : current);
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    setSelectionNotice(undefined);
    setSelectedNodeId(nodeId);
    updateViewState((state) => ({ ...state, selectedNodeId: nodeId }));
  }, [updateViewState]);

  const selectEntity = useCallback((entityId: string) => {
    if (!snapshot) {
      return;
    }
    const nodeId = getEntityNodeId(entityId, snapshot.nodes);
    if (nodeId) {
      selectNode(nodeId);
    }
  }, [selectNode, snapshot]);

  const toggleBranch = useCallback((nodeId: string) => {
    updateViewState((state) => {
      const collapsed = new Set(state.collapsedNodeIds);
      if (collapsed.has(nodeId)) {
        collapsed.delete(nodeId);
      } else {
        collapsed.add(nodeId);
      }
      return { ...state, collapsedNodeIds: [...collapsed] };
    });
  }, [updateViewState]);

  const toggleEliminated = useCallback((nodeId: string) => {
    updateViewState((state) => {
      const eliminated = new Set(state.eliminatedNodeIds);
      if (eliminated.has(nodeId)) {
        eliminated.delete(nodeId);
      } else {
        eliminated.add(nodeId);
      }
      return { ...state, eliminatedNodeIds: [...eliminated] };
    });
  }, [updateViewState]);

  const beginResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = mapWidth;
    const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width ?? 1;
    const resize = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - startX) / workspaceWidth) * 100;
      setMapWidth(Math.min(80, Math.max(40, startWidth + delta)));
    };
    const finish = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", finish, { once: true });
  }, [mapWidth]);

  const handleInitialize = useCallback(async () => {
    setSourceError(undefined);
    setSourceLoading(true);
    try {
      const picked = await client.selectSourceFolder(loadLastFolder());
      if (picked.cancelled || !picked.path) {
        return;
      }
      const nextLocation = await client.loadSource(picked.path);
      setActivePath(nextLocation.projectRoot);
      saveLastFolder(picked.path);
      await loadMap();
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Could not load the selected folder.");
    } finally {
      setSourceLoading(false);
    }
  }, [client, loadMap]);

  const handleReset = useCallback(() => {
    if (viewState?.investigationKey) {
      clearViewState(viewState.investigationKey);
    }
    previousSnapshotRef.current = undefined;
    setSnapshot(undefined);
    setSource(undefined);
    setLoadError(undefined);
    setConnection("connecting");
    setDiagnostics([]);
    setViewState(undefined);
    setSelectedNodeId(undefined);
    setDetails({});
    setDetailLoading(false);
    setDetailError(undefined);
    setSelectionNotice(undefined);
    setSourceError(undefined);
    setActivePath(undefined);
  }, [viewState]);

  const selectedDetail = snapshot && selectedNodeId
    ? details[snapshot.nodes.find((node) => node.id === selectedNodeId)?.detailRef.entityId ?? ""]
    : undefined;
  const selectedNode = snapshot?.nodes.find((node) => node.id === selectedNodeId);
  const parentNodeId = selectedNode?.parentId;
  const isEmpty = snapshot?.nodes.filter((node) => node.kind !== "investigation").length === 0;
  const workspaceStyle = { gridTemplateColumns: `${mapWidth}% 12px 1fr` } as CSSProperties;
  const breadcrumbs = snapshot && selectedNodeId ? getAncestorChain(selectedNodeId, snapshot.nodes) : [];
  const rootDocuments = snapshot && selectedNode?.kind === "investigation"
    ? snapshot.nodes.filter((node) => node.kind === "file" && node.parentId === selectedNode.id)
    : [];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Read-only investigation viewer</p>
          <h1>.ai Mind Map</h1>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => void handleInitialize()}
          disabled={sourceLoading}
          aria-label="Choose a folder to ingest as the investigation source"
          title="Choose a folder to ingest as the investigation source"
        >
          {sourceLoading ? "Loading…" : "📂 Initialize"}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={handleReset}
          disabled={sourceLoading || (!snapshot && !activePath)}
          aria-label="Clear all data currently loaded in the mind map"
          title="Clear all data currently loaded in the mind map"
        >
          🗑️ Reset
        </button>
        {activePath && (
          <div className="active-path" title={activePath}>
            <span className="active-path__label">Active folder:</span>
            <span className="active-path__value">{truncatePathForDisplay(activePath)}</span>
          </div>
        )}
        <div
          className="view-switcher"
          role="radiogroup"
          aria-label="Select mind map view"
        >
          {viewModeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={viewMode === option.value}
              className={`view-switcher__button${viewMode === option.value ? " view-switcher__button--active" : ""}`}
              onClick={() => setViewMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="connection-status" aria-live="polite">
          <span className={`status-dot status-dot--${connection}`} aria-hidden="true" />
          {connection === "connected" && "Live updates connected"}
          {connection === "connecting" && "Connecting to watcher"}
          {connection === "disconnected" && "Watcher disconnected"}
          {connection === "fixture" && "Development fixture"}
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
      </header>

      {breadcrumbs.length > 0 && (
        <nav className="breadcrumbs" aria-label="Investigation path">
          {breadcrumbs.map((node, index) => {
            const isCurrent = index === breadcrumbs.length - 1;
            return (
              <span key={node.id} className="breadcrumbs__segment">
                {index > 0 && <span className="breadcrumbs__separator" aria-hidden="true">/</span>}
                {isCurrent ? (
                  <span className="breadcrumbs__crumb breadcrumbs__crumb--current" aria-current="page">
                    {node.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="breadcrumbs__crumb"
                    onClick={() => selectNode(node.id)}
                  >
                    {node.label}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {source === "fixture" && (
        <aside className="banner banner--warning" role="status">
          Live API unavailable. Development fixture is active and will not be used in a production build.
        </aside>
      )}
      {sourceError && (
        <aside className="banner banner--danger" role="alert">
          {sourceError}
        </aside>
      )}
      {connection === "disconnected" && snapshot && (
        <aside className="banner banner--danger" role="status">
          Live refresh is disconnected. Showing the last successfully loaded map.
        </aside>
      )}
      {selectionNotice && <aside className="banner" role="status">{selectionNotice}</aside>}
      {diagnostics.length > 0 && (
        <aside className="banner banner--diagnostic" role="alert">
          <strong>Parse diagnostics ({diagnostics.length})</strong>
          <ul>
            {diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.message}-${index}`}>
                {diagnostic.severity}: {diagnostic.message}
                {diagnostic.source && ` (${diagnostic.source.relativePath}:${diagnostic.source.startLine})`}
              </li>
            ))}
          </ul>
        </aside>
      )}
      {loadError && (
        <section className="app-state app-state--error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="button" onClick={() => void loadMap()}>Retry</button>
        </section>
      )}
      {!snapshot && !loadError && <section className="app-state">Loading investigation map…</section>}
      {snapshot && isEmpty && (
        <section className="app-state">
          <h2>No parsed investigation notes</h2>
          <p>This .ai folder is empty or has no parsed semantic sections yet. The viewer will refresh when the watcher publishes a revision.</p>
        </section>
      )}
      {snapshot && viewState && !isEmpty && (
        <main className="workspace" ref={workspaceRef} style={workspaceStyle}>
          <section className="map-pane" aria-label="Mind map pane">
            {viewMode === "graph" ? (
              <ReactFlowMindMap
                graph={snapshot}
                viewState={viewState}
                selectedNodeId={selectedNodeId}
                onSelect={selectNode}
                onToggle={toggleBranch}
                onEliminate={toggleEliminated}
              />
            ) : (
              <RadialTreeMindMap
                graph={snapshot}
                viewState={viewState}
                selectedNodeId={selectedNodeId}
                onSelect={selectNode}
                onToggle={toggleBranch}
                onEliminate={toggleEliminated}
              />
            )}
          </section>
          <div
            className="split-resizer"
            role="separator"
            aria-label="Resize mind map and detail panes"
            aria-orientation="vertical"
            aria-valuemin={40}
            aria-valuemax={80}
            aria-valuenow={Math.round(mapWidth)}
            tabIndex={0}
            onPointerDown={beginResize}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                setMapWidth((current) => Math.max(40, current - 2));
              }
              if (event.key === "ArrowRight") {
                setMapWidth((current) => Math.min(80, current + 2));
              }
            }}
          />
          <NodeDetailPane
            detail={selectedDetail}
            loading={detailLoading}
            error={detailError}
            onSelectEntity={selectEntity}
            onOpenInEditor={(entityId) => client.openInEditor(entityId).then(() => undefined)}
            canGoBack={Boolean(parentNodeId)}
            rootDocuments={rootDocuments.map((node) => ({ entityId: node.detailRef.entityId, label: node.label }))}
            onBack={() => {
              if (parentNodeId) {
                selectNode(parentNodeId);
              }
            }}
          />
        </main>
      )}
    </div>
  );
}
