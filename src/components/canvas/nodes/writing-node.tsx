"use client";

import * as React from "react";
import {
  Sparkle as Sparkles,
  ArrowsOutSimple as Maximize2,
  Link as Link2,
} from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { DocEditor } from "@/components/editor/doc-editor";
import { useCanvasStore } from "@/store/canvas-store";
import { useNodeInputSources } from "@/store/use-sources";
import { extractText } from "@/lib/document";
import { cn } from "@/lib/utils";

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function WritingNode({ id, data, selected }: CanvasNodeProps) {
  const openSurface = useCanvasStore((s) => s.openSurface);
  const ensureDoc = useCanvasStore((s) => s.ensureDoc);
  const doc = useCanvasStore((s) => s.docs[id]);
  const updateDocTitle = useCanvasStore((s) => s.updateDocTitle);
  const direction = useCanvasStore((s) => s.direction);
  const sources = useNodeInputSources(id);

  React.useEffect(() => {
    ensureDoc(id, direction);
  }, [id, direction, ensureDoc]);

  const wc = React.useMemo(
    () => wordCount(extractText(doc?.content)),
    [doc?.content],
  );

  if (!doc) return null;

  return (
    <NodeShell
      id={id}
      kind="writing"
      selected={selected}
      modelId={data.modelId}
      onOpen={() => openSurface(id)}
      badge={
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            color: "var(--color-node-writing)",
            backgroundColor: "color-mix(in oklch, var(--color-node-writing) 12%, white)",
          }}
        >
          Primary
        </span>
      }
      className="!w-[540px]"
    >
      {/* Title */}
      <div className="mb-3 flex items-start gap-2.5">
        <div className="mt-1.5 h-6 w-0.5 shrink-0 rounded-full bg-ink/20" />
        <input
          value={doc.title}
          onChange={(e) => updateDocTitle(id, e.target.value)}
          placeholder="Untitled"
          className="nodrag w-full bg-transparent text-base font-semibold tracking-tight text-ink outline-none placeholder:text-grey-500"
        />
      </div>

      {/* Body — shared TipTap editor (same document as the full surface) */}
      <DocEditor nodeId={id} compact />

      {/* Action bar */}
      <div className="mt-3 flex items-center justify-between border-t border-grey-100 pt-3">
        <div className="flex items-center gap-3 text-[10px]">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              wc > 0 ? "bg-grey-100 text-grey-600" : "text-grey-500",
            )}
          >
            {wc > 0 ? `${wc} words` : "Blank"}
          </span>
          {sources.length > 0 && (
            <span className="flex items-center gap-1 text-grey-500">
              <Link2 className="size-3" />
              {sources.length}
            </span>
          )}
        </div>
        <div className="nodrag flex items-center gap-1">
          <button
            onClick={() => openSurface(id)}
            className="flex items-center gap-1 rounded-lg border border-grey-200 px-2.5 py-1 text-[10px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink"
          >
            <Sparkles className="size-3" />
            AI
          </button>
          <button
            onClick={() => openSurface(id)}
            className="flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-[10px] font-medium text-paper transition-colors hover:bg-grey-800"
          >
            <Maximize2 className="size-3" />
            Full editor
          </button>
        </div>
      </div>
    </NodeShell>
  );
}
