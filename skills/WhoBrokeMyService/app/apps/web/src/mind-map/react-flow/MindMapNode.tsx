import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { MindMapNode as MindMapNodeContract } from "../../contracts/api";

export interface MindMapFlowNodeData extends Record<string, unknown> {
  node: MindMapNodeContract;
  collapsed: boolean;
  eliminated: boolean;
  selected: boolean;
  onToggle: (nodeId: string) => void;
  onEliminate: (nodeId: string) => void;
}

const statusPresentation = {
  active: { icon: "●", label: "Active", className: "active" },
  supported: { icon: "✓", label: "Supported", className: "supported" },
  refuted: { icon: "!", label: "Refuted", className: "refuted" },
  superseded: { icon: "–", label: "Superseded", className: "superseded" },
  attention: { icon: "!", label: "Attention", className: "attention" },
} as const;

export type MindMapFlowNode = Node<MindMapFlowNodeData, "mindMap">;

export function MindMapNode({ data }: NodeProps<MindMapFlowNode>) {
  const { node } = data;
  const status = node.status ? statusPresentation[node.status] : undefined;
  const isExpandable = node.kind !== "item";

  return (
    <article
      className={[
        "mind-map-node",
        `mind-map-node--${node.kind}`,
        data.selected ? "mind-map-node--selected" : "",
        status ? `mind-map-node--${status.className}` : "",
        data.eliminated ? "mind-map-node--eliminated" : "",
      ].filter(Boolean).join(" ")}
      aria-label={`${node.kind}: ${node.label}${status ? `, ${status.label}` : ""}${
        data.eliminated ? ", eliminated" : ""
      }`}
    >
      <Handle className="mind-map-node__handle" type="target" position={Position.Left} isConnectable={false} />
      <header className="mind-map-node__header">
        <label
          className="mind-map-node__eliminate"
          title="Mark as eliminated / not a concern"
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={data.eliminated}
            onChange={() => data.onEliminate(node.id)}
            aria-label={`Mark ${node.label} as eliminated`}
          />
        </label>
        <span className="mind-map-node__kind">{node.kind === "item" ? node.itemKind ?? "item" : node.kind}</span>
        {isExpandable && (
          <button
            className="mind-map-node__toggle"
            type="button"
            aria-label={`${data.collapsed ? "Expand" : "Collapse"} ${node.label}`}
            onClick={(event) => {
              event.stopPropagation();
              data.onToggle(node.id);
            }}
          >
            {data.collapsed ? "+" : "–"}
          </button>
        )}
      </header>
      <strong className="mind-map-node__label">{node.label}</strong>
      {status && (
        <span className="mind-map-node__status">
          <span aria-hidden="true">{status.icon}</span>
          {status.label}
        </span>
      )}
      <Handle className="mind-map-node__handle" type="source" position={Position.Right} isConnectable={false} />
    </article>
  );
}
