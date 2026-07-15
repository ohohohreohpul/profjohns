"use client";

import * as React from "react";
import { TextT as Type } from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";

export function TextNode({ id, data, selected }: CanvasNodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const text = (data.text as string) ?? "";

  return (
    <NodeShell
      id={id}
      kind="text"
      selected={selected}
      modelId={data.modelId}
      hideModel
      className="w-80"
    >
      <textarea
        defaultValue={text}
        onChange={(e) => updateNodeData(id, { text: e.target.value })}
        placeholder="Write something…"
        rows={10}
        className="nodrag w-full resize-y rounded-lg border border-grey-200 bg-grey-50/50 px-3.5 py-3 text-[13px] leading-relaxed text-grey-800 outline-none ring-ink/5 transition-all placeholder:text-grey-500 focus:border-grey-300 focus:bg-paper focus:ring-4 min-h-[160px]"
      />
    </NodeShell>
  );
}