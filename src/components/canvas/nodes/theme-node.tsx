"use client";

import * as React from "react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCardNode } from "./use-card-node";
import { ThemeCardBody } from "@/components/board/cards/theme-card";
import { themeInsights } from "@/lib/canvas-cards";
import { useCanvasStore } from "@/store/canvas-store";

/** An argument the paper makes; insights connected into it are its evidence. */
export function ThemeNode({ id, data, selected }: CanvasNodeProps) {
  const { card, save } = useCardNode(id, "theme", data);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const insights = React.useMemo(() => themeInsights(nodes, edges, id), [nodes, edges, id]);
  const theme = card ?? { name: "" };
  return (
    <NodeShell id={id} kind="theme" selected={selected} modelId={data.modelId} hideModel className="w-72">
      <div className="nodrag">
        <ThemeCardBody
          data={theme}
          insights={insights}
          onRename={(name) => save({ ...theme, name })}
          onDropInsight={() => undefined}
          emptyHint="Drop an insight on this theme, or connect one to it."
        />
      </div>
    </NodeShell>
  );
}
