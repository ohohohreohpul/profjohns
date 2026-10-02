"use client";

import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCardNode } from "./use-card-node";
import { InsightCardBody } from "@/components/board/cards/insight-card";
import { INSIGHT_LABELS } from "@/lib/insight";

/** A verbatim quote with its paper and page; wire it into a Theme or the Draft. */
export function InsightNode({ id, data, selected }: CanvasNodeProps) {
  const { card, openPaper } = useCardNode(id, "insight", data);
  return (
    <NodeShell
      id={id}
      kind="insight"
      selected={selected}
      modelId={data.modelId}
      hideModel
      badge={card ? <span className="text-[10px] text-grey-500">{INSIGHT_LABELS[card.type] ?? "Insight"}</span> : undefined}
      onOpen={openPaper}
      className="w-72"
    >
      {card ? (
        <InsightCardBody data={card} onOpenSource={openPaper} />
      ) : (
        <p className="text-xs text-grey-600">Select a passage in the Reader and choose Make insight.</p>
      )}
    </NodeShell>
  );
}
