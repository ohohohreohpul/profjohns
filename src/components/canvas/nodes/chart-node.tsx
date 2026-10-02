"use client";

import * as React from "react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCardNode } from "./use-card-node";
import { ChartCardBody, chartFromTable } from "@/components/board/cards/chart-card";
import { ChartComposer } from "@/components/board/cards/chart-composer";
import { useCanvasStore } from "@/store/canvas-store";

/** A chart from a pasted table; edit its data from the toolbar. */
export function ChartNode({ id, data, selected }: CanvasNodeProps) {
  const { card, save, openPaper } = useCardNode(id, "chart", data);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const [editing, setEditing] = React.useState(false);
  return (
    <NodeShell
      id={id}
      kind="chart"
      selected={selected}
      modelId={data.modelId}
      hideModel
      hideTarget
      toolbar={
        card ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md px-2 py-1 text-xs font-medium text-grey-700 transition-colors hover:bg-grey-100 hover:text-ink"
          >
            Edit data
          </button>
        ) : undefined
      }
      className="w-72"
    >
      <div className="nodrag nowheel">
        {card ? (
          <ChartCardBody data={card} onChange={(next) => save(next)} editing={editing} onEditingChange={setEditing} onOpenSource={openPaper} />
        ) : (
          <ChartComposer submitLabel="Make chart" onCancel={() => removeNode(id)} onSubmit={(table, suggestion) => save(chartFromTable(table, suggestion))} />
        )}
      </div>
    </NodeShell>
  );
}
