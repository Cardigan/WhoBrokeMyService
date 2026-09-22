import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MindMapNode, MindMapProjection, MindMapViewState, Point } from "../../contracts/api";
import "./radial-tree.css";

interface RadialTreeMindMapProps {
  graph: MindMapProjection;
  viewState: MindMapViewState;
  selectedNodeId?: string;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  onEliminate: (nodeId: string) => void;
}

interface RadialPoint {
  x: number;
  y: number;
}

interface RadialLayoutNode {
  node: MindMapNode;
  point: RadialPoint;
  hasChildren: boolean;
}

interface RadialLayoutEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

interface RadialLayout {
  nodes: RadialLayoutNode[];
  edges: RadialLayoutEdge[];
}

const viewBoxSize = 1000;
const center: RadialPoint = { x: viewBoxSize / 2, y: viewBoxSize / 2 };
const ring1Radius = 190;
const ring2Radius = 350;
const ring1NodeRadius = 44;
const ring2NodeRadius = 30;
const rootNodeRadius = 56;
const minViewBoxSize = 150;
const maxViewBoxSize = 2200;
const zoomInFactor = 0.8;
const zoomOutFactor = 1.25;
const minNodeScale = 0.6;
const maxNodeScale = 2.5;
const defaultNodeScale = 1;
const minCircleScale = 0.5;
const maxCircleScale = 2;
const defaultCircleScale = 1;
// Generous bounds so background drag-to-pan keeps working no matter how far
// the user has already panned or zoomed.
const backgroundExtent = 5000;

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function defaultViewBox(): ViewBox {
  return { x: 0, y: 0, width: viewBoxSize, height: viewBoxSize };
}

function clampSize(size: number): number {
  return Math.min(maxViewBoxSize, Math.max(minViewBoxSize, size));
}

function fitLayoutViewBox(layout: RadialLayout, circleScale: number): ViewBox {
  if (layout.nodes.length === 0) {
    return defaultViewBox();
  }
  const padding = 80;
  const bounds = layout.nodes.reduce(
    (current, { node, point }) => {
      const radius = nodeRadiusFor(node.kind) * circleScale;
      return {
        minX: Math.min(current.minX, point.x - radius),
        minY: Math.min(current.minY, point.y - radius),
        maxX: Math.max(current.maxX, point.x + radius),
        maxY: Math.max(current.maxY, point.y + radius),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  const size = clampSize(Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) + padding * 2);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    x: centerX - size / 2,
    y: centerY - size / 2,
    width: size,
    height: size,
  };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function pointOnCircle(originPoint: RadialPoint, radius: number, angleDegrees: number): RadialPoint {
  const angle = toRadians(angleDegrees);
  return {
    x: originPoint.x + Math.cos(angle) * radius,
    y: originPoint.y + Math.sin(angle) * radius,
  };
}

function applyOffset(point: RadialPoint, offset?: Point): RadialPoint {
  return offset
    ? { x: point.x + offset.x, y: point.y + offset.y }
    : point;
}

function buildLayout(
  graph: MindMapProjection,
  collapsedNodeIds: string[],
  savedOffsets: Record<string, Point>,
  nodeScale: number,
): RadialLayout {
  const scaledRing1Radius = ring1Radius * nodeScale;
  const scaledRing2Radius = ring2Radius * nodeScale;
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, MindMapNode[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "contains") {
      continue;
    }
    const target = byId.get(edge.target);
    if (!target) {
      continue;
    }
    const siblings = childrenByParent.get(edge.source) ?? [];
    siblings.push(target);
    childrenByParent.set(edge.source, siblings);
  }

  const root = byId.get(graph.rootNodeId);
  if (!root) {
    return { nodes: [], edges: [] };
  }

  const collapsed = new Set(collapsedNodeIds);

  const rootPoint = applyOffset(center, savedOffsets[root.id]);
  const layoutNodes: RadialLayoutNode[] = [
    { node: root, point: rootPoint, hasChildren: (childrenByParent.get(root.id) ?? []).length > 0 },
  ];
  const layoutEdges: RadialLayoutEdge[] = [];

  const fileNodes = childrenByParent.get(root.id) ?? [];
  fileNodes.forEach((fileNode, fileIndex) => {
    const fileAngle = -90 + (fileIndex * 360) / Math.max(fileNodes.length, 1);
    const filePoint = applyOffset(
      pointOnCircle(center, scaledRing1Radius, fileAngle),
      savedOffsets[fileNode.id],
    );
    const itemNodes = childrenByParent.get(fileNode.id) ?? [];
    layoutNodes.push({ node: fileNode, point: filePoint, hasChildren: itemNodes.length > 0 });
    layoutEdges.push({ id: `${root.id}->${fileNode.id}`, sourceId: root.id, targetId: fileNode.id });

    if (collapsed.has(fileNode.id)) {
      return;
    }

    const spreadDegrees = 60;
    itemNodes.forEach((itemNode, itemIndex) => {
      const offset =
        itemNodes.length <= 1
          ? 0
          : -spreadDegrees / 2 + (itemIndex * spreadDegrees) / (itemNodes.length - 1);
      const itemPoint = applyOffset(
        pointOnCircle(center, scaledRing2Radius, fileAngle + offset),
        savedOffsets[itemNode.id],
      );
      layoutNodes.push({ node: itemNode, point: itemPoint, hasChildren: false });
      layoutEdges.push({ id: `${fileNode.id}->${itemNode.id}`, sourceId: fileNode.id, targetId: itemNode.id });
    });
  });

  return { nodes: layoutNodes, edges: layoutEdges };
}

function getDescendantIds(nodeId: string, graph: MindMapProjection): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (!node.parentId) {
      continue;
    }
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  }

  const descendants: string[] = [];
  const pending = [...(childrenByParent.get(nodeId) ?? [])];
  while (pending.length > 0) {
    const descendantId = pending.pop();
    if (!descendantId) {
      continue;
    }
    descendants.push(descendantId);
    pending.push(...(childrenByParent.get(descendantId) ?? []));
  }
  return descendants;
}

function toSvgPoint(
  svg: SVGSVGElement,
  viewBox: ViewBox,
  clientX: number,
  clientY: number,
): RadialPoint {
  const rect = svg.getBoundingClientRect();
  return {
    x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
    y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
  };
}

function nodeRadiusFor(kind: MindMapNode["kind"]): number {
  if (kind === "investigation") {
    return rootNodeRadius;
  }
  return kind === "file" ? ring1NodeRadius : ring2NodeRadius;
}

function truncateLabel(label: string, maxLength: number): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

export function RadialTreeMindMap({
  graph,
  viewState,
  selectedNodeId,
  onSelect,
  onToggle,
  onEliminate,
}: RadialTreeMindMapProps) {
  const [viewBox, setViewBox] = useState<ViewBox>(defaultViewBox);
  const [nodeScale, setNodeScale] = useState(defaultNodeScale);
  const [circleScale, setCircleScale] = useState(defaultCircleScale);
  const [manualOffsets, setManualOffsets] = useState<Record<string, Point>>({});
  const layout = useMemo(
    () => buildLayout(graph, viewState.collapsedNodeIds, manualOffsets, nodeScale),
    [graph, manualOffsets, nodeScale, viewState.collapsedNodeIds],
  );
  const fullLayout = useMemo(
    () => buildLayout(graph, [], manualOffsets, nodeScale),
    [graph, manualOffsets, nodeScale],
  );
  const baseFullLayout = useMemo(
    () => buildLayout(graph, [], {}, nodeScale),
    [graph, nodeScale],
  );
  const automaticLayout = useMemo(
    () => buildLayout(graph, viewState.collapsedNodeIds, {}, nodeScale),
    [graph, nodeScale, viewState.collapsedNodeIds],
  );
  const autoFitKey = `${graph.investigationRevision}:${viewState.collapsedNodeIds.join("|")}:${nodeScale}:${circleScale}`;
  const collapsed = new Set(viewState.collapsedNodeIds);
  const eliminated = new Set(viewState.eliminatedNodeIds);

  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [draggedPositions, setDraggedPositions] = useState<Record<string, Point>>({});
  const draggedPositionsRef = useRef<Record<string, Point>>({});
  const [draggedNodeId, setDraggedNodeId] = useState<string | undefined>(undefined);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startViewBox: ViewBox;
  } | null>(null);
  const nodeDragStateRef = useRef<{
    pointerId: number;
    nodeId: string;
    startPointer: RadialPoint;
    starts: Record<string, Point>;
    didMove: boolean;
  } | null>(null);
  const suppressClickNodeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setManualOffsets({});
    setDraggedPositions({});
    draggedPositionsRef.current = {};
    nodeDragStateRef.current = null;
    setDraggedNodeId(undefined);
    setViewBox(fitLayoutViewBox(automaticLayout, circleScale));
  }, [autoFitKey, automaticLayout, circleScale]);

  const fullPositionById = useMemo(
    () => new Map(fullLayout.nodes.map(({ node, point }) => [node.id, point])),
    [fullLayout.nodes],
  );
  const basePositionById = useMemo(
    () => new Map(baseFullLayout.nodes.map(({ node, point }) => [node.id, point])),
    [baseFullLayout.nodes],
  );
  const displayPositionById = useMemo(
    () => new Map(layout.nodes.map(({ node, point }) => [node.id, draggedPositions[node.id] ?? point])),
    [draggedPositions, layout.nodes],
  );

  // Trackpad pinch gestures (and Ctrl+scroll on a mouse) are delivered to the
  // browser as `wheel` events with `ctrlKey` set - that is the standard way
  // to detect a pinch-to-zoom gesture, so we zoom on that and pan on a plain
  // two-finger scroll. React marks `wheel` listeners passive by default, so a
  // native listener is required to call preventDefault and stop the browser
  // from also zooming the whole page.
  const handleWheel = useCallback((event: WheelEvent) => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    event.preventDefault();

    if (event.ctrlKey) {
      const rect = svg.getBoundingClientRect();
      const pointerXRatio = (event.clientX - rect.left) / rect.width;
      const pointerYRatio = (event.clientY - rect.top) / rect.height;

      setViewBox((prev) => {
        const nextSize = clampSize(prev.width * Math.exp(event.deltaY * 0.01));
        const anchorX = prev.x + pointerXRatio * prev.width;
        const anchorY = prev.y + pointerYRatio * prev.height;
        return {
          width: nextSize,
          height: nextSize,
          x: anchorX - pointerXRatio * nextSize,
          y: anchorY - pointerYRatio * nextSize,
        };
      });
      return;
    }

    setViewBox((prev) => ({
      ...prev,
      x: prev.x + event.deltaX * (prev.width / viewBoxSize),
      y: prev.y + event.deltaY * (prev.height / viewBoxSize),
    }));
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return undefined;
    }
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleBackgroundPointerDown = (event: React.PointerEvent<SVGRectElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewBox: viewBox,
    };
    setIsPanning(true);
  };

  const handleBackgroundPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const drag = dragStateRef.current;
    const svg = svgRef.current;
    if (!drag || !svg || drag.pointerId !== event.pointerId) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    const dx = ((event.clientX - drag.startClientX) * drag.startViewBox.width) / rect.width;
    const dy = ((event.clientY - drag.startClientY) * drag.startViewBox.height) / rect.height;
    setViewBox({
      ...drag.startViewBox,
      x: drag.startViewBox.x - dx,
      y: drag.startViewBox.y - dy,
    });
  };

  const endBackgroundDrag = (event: React.PointerEvent<SVGRectElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setIsPanning(false);
    }
  };

  const zoomBy = (factor: number) => {
    setViewBox((prev) => {
      const nextSize = clampSize(prev.width * factor);
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;
      return {
        width: nextSize,
        height: nextSize,
        x: centerX - nextSize / 2,
        y: centerY - nextSize / 2,
      };
    });
  };

  const resetView = () => setViewBox(fitLayoutViewBox(layout, circleScale));

  const handleNodePointerDown = (
    event: React.PointerEvent<SVGGElement>,
    nodeId: string,
  ) => {
    const svg = svgRef.current;
    const nodeStart = fullPositionById.get(nodeId);
    if (!svg || !nodeStart) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const movedIds = [nodeId, ...getDescendantIds(nodeId, graph)];
    const starts = Object.fromEntries(
      movedIds.flatMap((movedId) => {
        const point = fullPositionById.get(movedId);
        return point ? [[movedId, point] as const] : [];
      }),
    );
    nodeDragStateRef.current = {
      pointerId: event.pointerId,
      nodeId,
      startPointer: toSvgPoint(svg, viewBox, event.clientX, event.clientY),
      starts,
      didMove: false,
    };
    setDraggedNodeId(nodeId);
  };

  const handleNodePointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const drag = nodeDragStateRef.current;
    const svg = svgRef.current;
    if (!drag || !svg || drag.pointerId !== event.pointerId) {
      return;
    }
    event.stopPropagation();
    const pointer = toSvgPoint(svg, viewBox, event.clientX, event.clientY);
    const delta = {
      x: pointer.x - drag.startPointer.x,
      y: pointer.y - drag.startPointer.y,
    };
    if (Math.abs(delta.x) + Math.abs(delta.y) > 2) {
      drag.didMove = true;
    }
    const nextPositions = Object.fromEntries(
      Object.entries(drag.starts).map(([id, start]) => [
        id,
        { x: start.x + delta.x, y: start.y + delta.y },
      ]),
    );
    draggedPositionsRef.current = nextPositions;
    setDraggedPositions(nextPositions);
  };

  const endNodeDrag = (event: React.PointerEvent<SVGGElement>) => {
    const drag = nodeDragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.stopPropagation();
    nodeDragStateRef.current = null;
    setDraggedNodeId(undefined);
    if (drag.didMove) {
      const nextOffsets = Object.fromEntries(
        Object.entries(draggedPositionsRef.current).flatMap(([id, point]) => {
          const basePoint = basePositionById.get(id);
          return basePoint
            ? [[id, { x: point.x - basePoint.x, y: point.y - basePoint.y }] as const]
            : [];
        }),
      );
      setManualOffsets((current) => ({ ...current, ...nextOffsets }));
      suppressClickNodeRef.current = drag.nodeId;
      window.setTimeout(() => {
        if (suppressClickNodeRef.current === drag.nodeId) {
          suppressClickNodeRef.current = undefined;
        }
      }, 0);
    }
    draggedPositionsRef.current = {};
    setDraggedPositions({});
  };

  return (
    <div className="mind-map-canvas radial-tree-canvas" aria-label="Investigation radial tree">
      <svg
        ref={svgRef}
        className="radial-tree-svg"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="group"
        aria-label="Radial tree of investigation nodes"
      >
        <rect
          className={`radial-tree-background${isPanning ? " radial-tree-background--panning" : ""}`}
          x={-backgroundExtent}
          y={-backgroundExtent}
          width={backgroundExtent * 2}
          height={backgroundExtent * 2}
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={endBackgroundDrag}
          onPointerCancel={endBackgroundDrag}
          onDoubleClick={resetView}
        />
        <g className="radial-tree-rings">
          <circle className="radial-tree-ring" cx={center.x} cy={center.y} r={ring1Radius * nodeScale} />
          <circle className="radial-tree-ring" cx={center.x} cy={center.y} r={ring2Radius * nodeScale} />
        </g>
        <g className="radial-tree-edges">
          {layout.edges.map((edge) => (
            <line
              key={edge.id}
              x1={displayPositionById.get(edge.sourceId)?.x ?? 0}
              y1={displayPositionById.get(edge.sourceId)?.y ?? 0}
              x2={displayPositionById.get(edge.targetId)?.x ?? 0}
              y2={displayPositionById.get(edge.targetId)?.y ?? 0}
              className="radial-tree-edge"
            />
          ))}
        </g>
        <g className="radial-tree-nodes">
          {layout.nodes.map(({ node, point, hasChildren }) => {
            const displayPoint = displayPositionById.get(node.id) ?? point;
            const radius = nodeRadiusFor(node.kind) * circleScale;
            const isCollapsed = collapsed.has(node.id);
            const isSelected = node.id === selectedNodeId;
            const isEliminated = eliminated.has(node.id);
            const labelMaxLength = node.kind === "investigation" ? 24 : node.kind === "file" ? 18 : 14;
            const classNames = [
              "radial-node",
              `radial-node--${node.kind}`,
              node.status ? `radial-node--${node.status}` : "",
              isSelected ? "radial-node--selected" : "",
              isEliminated ? "radial-node--eliminated" : "",
              draggedNodeId === node.id ? "radial-node--dragging" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <g
                key={node.id}
                className={classNames}
                transform={`translate(${displayPoint.x}, ${displayPoint.y})`}
                tabIndex={0}
                onPointerDown={(event) => handleNodePointerDown(event, node.id)}
                onPointerMove={handleNodePointerMove}
                onPointerUp={endNodeDrag}
                onPointerCancel={endNodeDrag}
                onClick={() => {
                  if (suppressClickNodeRef.current === node.id) {
                    suppressClickNodeRef.current = undefined;
                    return;
                  }
                  onSelect(node.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(node.id);
                  }
                }}
                aria-label={`${node.kind === "item" ? node.itemKind ?? "item" : node.kind}: ${node.label}${
                  node.status ? `, ${node.status}` : ""
                }${isEliminated ? ", eliminated" : ""}`}
              >
                <circle className="radial-node__circle" r={radius} />
                <text className="radial-node__label" y={radius + 16} textAnchor="middle">
                  {truncateLabel(node.label, labelMaxLength)}
                </text>
                <g
                  className="radial-node__eliminate"
                  role="checkbox"
                  aria-checked={isEliminated}
                  tabIndex={0}
                  transform={`translate(${-radius + 6}, ${-radius + 6})`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEliminate(node.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onEliminate(node.id);
                    }
                  }}
                  aria-label={`${isEliminated ? "Unmark" : "Mark"} ${node.label} as eliminated`}
                >
                  <circle r={11} />
                  {isEliminated && (
                    <path d="M -4.5 0.5 L -1.5 3.5 L 4.5 -3.5" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </g>
                {hasChildren && (
                  <g
                    className="radial-node__toggle"
                    role="button"
                    tabIndex={0}
                    transform={`translate(${radius - 6}, ${-radius + 6})`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(node.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onToggle(node.id);
                      }
                    }}
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.label}`}
                  >
                    <circle r={11} />
                    <text y={4} textAnchor="middle">
                      {isCollapsed ? "+" : "–"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="radial-tree-controls" role="group" aria-label="Zoom controls">
        <button type="button" onClick={() => zoomBy(zoomInFactor)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(zoomOutFactor)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={resetView} aria-label="Reset zoom">
          ⟲
        </button>
      </div>
      <div className="radial-tree-scale-controls">
        <div className="radial-tree-scale-control" role="group" aria-label="Node spacing controls">
          <label htmlFor="radial-node-scale">Spacing</label>
          <input
            id="radial-node-scale"
            type="range"
            min={minNodeScale}
            max={maxNodeScale}
            step={0.1}
            value={nodeScale}
            onChange={(event) => setNodeScale(Number(event.target.value))}
          />
        </div>
        <div className="radial-tree-scale-control" role="group" aria-label="Node size controls">
          <label htmlFor="radial-circle-scale">Node size</label>
          <input
            id="radial-circle-scale"
            type="range"
            min={minCircleScale}
            max={maxCircleScale}
            step={0.1}
            value={circleScale}
            onChange={(event) => setCircleScale(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
