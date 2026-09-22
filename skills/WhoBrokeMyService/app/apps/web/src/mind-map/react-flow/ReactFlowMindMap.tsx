import { useEffect, useMemo, useRef, useState } from "react";
import {
  BaseEdge,
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type NodeMouseHandler,
  type NodeTypes,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { MindMapProjection, MindMapViewState, Point } from "../../contracts/api";
import { dagreMindMapLayout, nodeHeight, nodeWidth } from "../layout";
import { MindMapNode, type MindMapFlowNode } from "./MindMapNode";
import "./react-flow.css";

interface ReactFlowMindMapProps {
  graph: MindMapProjection;
  viewState: MindMapViewState;
  selectedNodeId?: string;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  onEliminate: (nodeId: string) => void;
}

const nodeTypes: NodeTypes = { mindMap: MindMapNode };
const defaultEdgeCurvature = 0.25;

function TunableCurveEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerStart,
  markerEnd,
  style,
  interactionWidth,
}: EdgeProps) {
  const curvature = typeof data?.curvature === "number" ? data.curvature : defaultEdgeCurvature;
  const horizontalDistance = Math.abs(targetX - sourceX);
  const controlDistance = Math.max(36, horizontalDistance * (0.3 + curvature * 0.35));
  const bend = Math.max(18, horizontalDistance * 0.1) * curvature;
  const path = [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX + controlDistance} ${sourceY + bend},`,
    `${targetX - controlDistance} ${targetY - bend},`,
    `${targetX} ${targetY}`,
  ].join(" ");

  return (
    <BaseEdge
      id={id}
      path={path}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={interactionWidth}
    />
  );
}

const edgeTypes: EdgeTypes = { tunableCurve: TunableCurveEdge };

function isVisible(nodeId: string, graph: MindMapProjection, collapsedNodeIds: Set<string>): boolean {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  let parentId = byId.get(nodeId)?.parentId;
  while (parentId) {
    if (collapsedNodeIds.has(parentId)) {
      return false;
    }
    parentId = byId.get(parentId)?.parentId;
  }
  return true;
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

interface DragSnapshot {
  rootStart: Point;
  descendantStarts: Record<string, Point>;
}

/** Smoothly pans/zooms the canvas so the selected node stays centered. */
function CenterOnSelection({ selectedNodeId }: { selectedNodeId?: string }) {
  const { getNode, setCenter, getZoom } = useReactFlow();

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }
    const node = getNode(selectedNodeId);
    if (!node) {
      return;
    }
    const width = node.measured?.width ?? nodeWidth;
    const height = node.measured?.height ?? nodeHeight;
    setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      zoom: Math.max(getZoom(), 0.75),
      duration: 450,
    });
  }, [selectedNodeId, getNode, setCenter, getZoom]);

  return null;
}

function FitVisibleNodes({ visibilityKey }: { visibilityKey: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    let secondFrame: number | undefined;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        void fitView({ padding: 0.3, duration: 450 });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [fitView, visibilityKey]);

  return null;
}

export function ReactFlowMindMap({
  graph,
  viewState,
  selectedNodeId,
  onSelect,
  onToggle,
  onEliminate,
}: ReactFlowMindMapProps) {
  const [edgeCurvature, setEdgeCurvature] = useState(defaultEdgeCurvature);
  const [isDraggingSubtree, setIsDraggingSubtree] = useState(false);
  const dragSnapshotRef = useRef<DragSnapshot | undefined>(undefined);
  const { nodes, edges, visibilityKey } = useMemo(() => {
    const collapsed = new Set(viewState.collapsedNodeIds);
    const eliminated = new Set(viewState.eliminatedNodeIds);
    const visibleNodes = graph.nodes.filter((node) => isVisible(node.id, graph, collapsed));
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = graph.edges.filter(
      (edge) => edge.relation === "contains" && visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );
    const positions = dagreMindMapLayout.layout({ ...graph, nodes: visibleNodes, edges: visibleEdges });
    const flowNodes: MindMapFlowNode[] = visibleNodes
      .map((node) => ({
        id: node.id,
        type: "mindMap",
        position: positions[node.id],
        selected: node.id === selectedNodeId,
        data: {
          node,
          collapsed: collapsed.has(node.id),
          eliminated: eliminated.has(node.id),
          selected: node.id === selectedNodeId,
          onToggle,
          onEliminate,
        },
      }));
    const flowEdges: Edge[] = visibleEdges
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "tunableCurve",
        data: { curvature: edgeCurvature },
        selectable: false,
        focusable: false,
        className: "mind-map-edge",
      }));
    return {
      nodes: flowNodes,
      edges: flowEdges,
      visibilityKey: `${graph.investigationRevision}:${visibleNodes.map((node) => node.id).join("|")}`,
    };
  }, [edgeCurvature, graph, onEliminate, onToggle, selectedNodeId, viewState.collapsedNodeIds, viewState.eliminatedNodeIds]);
  const [renderedNodes, setRenderedNodes, onNodesChange] = useNodesState<MindMapFlowNode>(nodes);
  const previousVisibilityKeyRef = useRef(visibilityKey);

  useEffect(() => {
    const visibilityChanged = previousVisibilityKeyRef.current !== visibilityKey;
    previousVisibilityKeyRef.current = visibilityKey;
    setRenderedNodes((current) => {
      if (visibilityChanged) {
        return nodes;
      }
      const currentPositions = new Map(current.map((node) => [node.id, node.position]));
      return nodes.map((node) => ({
        ...node,
        position: currentPositions.get(node.id) ?? node.position,
      }));
    });
  }, [nodes, setRenderedNodes, visibilityKey]);

  const handleNodeClick: NodeMouseHandler<MindMapFlowNode> = (_, node) => onSelect(node.id);
  const handleNodeDragStart: OnNodeDrag<MindMapFlowNode> = (_, node) => {
    const currentPositions = new Map(renderedNodes.map((renderedNode) => [renderedNode.id, renderedNode.position]));
    const descendantStarts = Object.fromEntries(
      getDescendantIds(node.id, graph).flatMap((descendantId) => {
        const position = currentPositions.get(descendantId);
        return position ? [[descendantId, position] as const] : [];
      }),
    );
    dragSnapshotRef.current = {
      rootStart: { ...node.position },
      descendantStarts,
    };
    setIsDraggingSubtree(true);
  };
  const handleNodeDrag: OnNodeDrag<MindMapFlowNode> = (_, node) => {
    const snapshot = dragSnapshotRef.current;
    if (!snapshot) {
      return;
    }
    const delta = {
      x: node.position.x - snapshot.rootStart.x,
      y: node.position.y - snapshot.rootStart.y,
    };
    setRenderedNodes((current) => current.map((renderedNode) => {
      const start = snapshot.descendantStarts[renderedNode.id];
      return start
        ? { ...renderedNode, position: { x: start.x + delta.x, y: start.y + delta.y } }
        : renderedNode;
    }));
  };
  const handleNodeDragStop: OnNodeDrag<MindMapFlowNode> = () => {
    dragSnapshotRef.current = undefined;
    setIsDraggingSubtree(false);
  };

  return (
    <div
      className={`mind-map-canvas${isDraggingSubtree ? " mind-map-canvas--dragging-subtree" : ""}`}
      aria-label="Investigation mind map"
    >
      <ReactFlowProvider>
        <ReactFlow<MindMapFlowNode, Edge>
          nodes={renderedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          nodesConnectable={false}
          edgesFocusable={false}
          elementsSelectable
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.25}
          maxZoom={2}
          panOnDrag
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="var(--cp-border)" />
          <Controls showInteractive={false} />
          <Panel position="top-left" className="curve-tuner">
            <label htmlFor="edge-curvature">Curve</label>
            <input
              id="edge-curvature"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={edgeCurvature}
              onChange={(event) => setEdgeCurvature(event.currentTarget.valueAsNumber)}
            />
            <input
              className="curve-tuner__value"
              type="number"
              min="0"
              max="1"
              step="0.05"
              aria-label="Edge curvature value"
              value={edgeCurvature}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value)) {
                  setEdgeCurvature(Math.min(1, Math.max(0, value)));
                }
              }}
            />
          </Panel>
          <FitVisibleNodes visibilityKey={visibilityKey} />
          <CenterOnSelection selectedNodeId={selectedNodeId} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
