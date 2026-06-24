"use client";

import * as React from "react";
import {
  Sparkle as Sparkles,
  ArrowsOutSimple as Maximize2,
  Link as Link2,
  FileText,
} from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { FormattingToolbar } from "./formatting-toolbar";
import { useCanvasStore } from "@/store/canvas-store";
import { useNodeInputSources } from "@/store/use-sources";
import { cn } from "@/lib/utils";

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function WritingNode({ id, data, selected }: CanvasNodeProps) {
  const openSurface = useCanvasStore((s) => s.openSurface);
  const ensureDoc = useCanvasStore((s) => s.ensureDoc);
  const doc = useCanvasStore((s) => s.docs[id]);
  const updateDocTitle = useCanvasStore((s) => s.updateDocTitle);
  const setDocPlainText = useCanvasStore((s) => s.setDocPlainText);
  const direction = useCanvasStore((s) => s.direction);
  const sources = useNodeInputSources(id);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const dirty = React.useRef(false);
  const syncTimer = React.useRef<ReturnType<typeof setTimeout>>(null as unknown as ReturnType<typeof setTimeout>);

  React.useEffect(() => {
    ensureDoc(id, direction);
  }, [id, direction, ensureDoc]);

  // Seed body from stored blocks, and re-sync when blocks change externally
  const fullText = React.useMemo(
    () => (doc?.blocks ?? []).map((b) => b.text).join("\n\n"),
    [doc?.blocks],
  );

  React.useEffect(() => {
    if (!bodyRef.current || dirty.current) return;
    const current = bodyRef.current.innerText;
    if (current !== fullText) {
      bodyRef.current.innerText = fullText;
    }
  }, [fullText]);

  const wc = wordCount(fullText);
  const isEmpty = fullText.trim().length === 0;

  function sync() {
    if (!bodyRef.current) return;
    const text = bodyRef.current.innerText ?? "";
    dirty.current = true;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      setDocPlainText(id, text);
    }, 300);
  }

  if (!doc) return null;

  return (
    <NodeShell
      id={id}
      kind="writing"
      selected={selected}
      modelId={data.modelId}
      onOpen={() => openSurface(id)}
      toolbar={<FormattingToolbar />}
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
          className="nodrag w-full bg-transparent text-base font-semibold tracking-tight text-ink outline-none placeholder:text-grey-300"
        />
      </div>

      {/* Body — single contentEditable, like Gdocs */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        data-placeholder={isEmpty ? "Just start typing — bold (⌘B), italic (⌘I), Enter for new paragraph" : "Continue writing…"}
        className={cn(
          "nodrag nowheel min-h-[200px] cursor-text resize-y overflow-auto rounded-lg border px-4 py-3.5",
          "text-[13.5px] leading-[1.7] text-grey-800 outline-none transition-colors",
          "border-grey-200 outline-none ring-ink/5 focus:border-grey-300 focus:bg-grey-50/50 focus:ring-4",
          // Heading styles for formatBlock output
          "[&_h1]:my-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-ink",
          "[&_h2]:my-1 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink",
          "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
          isEmpty && "border-dashed bg-grey-50/50 text-grey-400",
        )}
      />

      {/* Action bar */}
      <div className="mt-3 flex items-center justify-between border-t border-grey-100 pt-3">
        <div className="flex items-center gap-3 text-[10px]">
          <span className={cn(
            "rounded-full px-2 py-0.5 font-medium",
            wc > 0 ? "bg-grey-100 text-grey-600" : "text-grey-300",
          )}>
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