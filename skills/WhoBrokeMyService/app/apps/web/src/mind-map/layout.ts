import dagre from "dagre";
import type { MindMapProjection, Point } from "../contracts/api";

export interface MindMapLayoutEngine {
  layout(graph: MindMapProjection): Record<string, Point>;
}

export const nodeWidth = 220;
export const nodeHeight = 76;

export const dagreMindMapLayout: MindMapLayoutEngine = {
  layout(graph) {
    const layoutGraph = new dagre.graphlib.Graph();
    layoutGraph.setGraph({
      rankdir: "LR",
      nodesep: 20,
      ranksep: 56,
      marginx: 16,
      marginy: 16,
      ranker: "tight-tree",
    });
    layoutGraph.setDefaultEdgeLabel(() => ({}));

    graph.nodes.forEach((node) => layoutGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }));
    graph.edges
      .filter((edge) => edge.relation === "contains")
      .forEach((edge) => layoutGraph.setEdge(edge.source, edge.target));

    dagre.layout(layoutGraph);
    return Object.fromEntries(graph.nodes.map((node) => {
      const calculated = layoutGraph.node(node.id) as { x: number; y: number };
      return [
        node.id,
        {
          x: calculated.x - nodeWidth / 2,
          y: calculated.y - nodeHeight / 2,
        },
      ];
    }));
  },
};
