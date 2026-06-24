"use client";

import * as React from "react";
import { BookOpen, ArrowSquareOut as ExternalLink } from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import type { PaperSource } from "@/lib/mock";

export function PaperNode({ id, data, selected }: CanvasNodeProps) {
  const openReader = useCanvasStore((s) => s.openReader);
  const paper = data.paper as PaperSource | undefined;

  if (!paper) return null;

  const meta = [paper.authors, paper.year].filter(Boolean).join(" · ");

  return (
    <NodeShell
      id={id}
      kind="paper"
      selected={selected}
      modelId={data.modelId}
      hideModel
      hideTarget
      onOpen={paper.url ? () => openReader(paper) : undefined}
      className="w-72"
    >
      <p className="text-[13px] font-semibold leading-snug text-ink">{paper.title}</p>
      {meta && <p className="mt-1 text-[11px] text-grey-400">{meta}</p>}
      {paper.abstract && (
        <p className="mt-2 line-clamp-4 text-[11.5px] leading-relaxed text-grey-600">
          {paper.abstract}
        </p>
      )}
      <div className="nodrag mt-2.5 flex items-center gap-1">
        {paper.url && (
          <button
            onClick={() => openReader(paper)}
            className="flex items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-[10px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink"
          >
            <BookOpen className="size-3" />
            Read
          </button>
        )}
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
          >
            <ExternalLink className="size-3" />
            Source
          </a>
        )}
      </div>
    </NodeShell>
  );
}
