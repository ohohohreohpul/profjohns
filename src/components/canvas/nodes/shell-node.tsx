"use client";

import * as React from "react";
import { NodeResizer } from "@xyflow/react";
import { Package as Container, CaretDown as ChevronDown, CaretRight as ChevronRight, Plus, X, GitBranch, CircleNotch as Loader2 } from "@phosphor-icons/react";
import { type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import { generateDiagram } from "@/lib/ai-client";
import { cn } from "@/lib/utils";

export function ShellNode({ id, data, selected }: CanvasNodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const nodes = useCanvasStore((s) => s.nodes);
  const label = (data.label as string | undefined) ?? "Untitled section";
  const children = nodes.filter((n) => n.parentId === id);
  const hasChildren = children.length > 0;
  const [diagramBusy, setDiagramBusy] = React.useState(false);

  async function handleGenerateDiagram() {
    const allText = children
      .map((c) => (c.data as Record<string, unknown>).text ?? (c.data as Record<string, unknown>).label ?? "")
      .filter(Boolean)
      .join("\n\n");
    if (!allText.trim()) return;
    setDiagramBusy(true);
    try {
      const mermaidCode = await generateDiagram(allText);
      const canvas = useCanvasStore.getState();
      const newId = canvas.addNode("block", {
        x: 16,
        y: children.length * 50 + 80,
      }, { variant: "diagram", text: mermaidCode, html: mermaidCode, parentId: id });
    } catch {
      // silent
    } finally {
      setDiagramBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "animate-node-in group/shell relative flex size-full min-w-[200px] flex-col rounded-2xl bg-feedback-warning-bg/30 transition-shadow duration-200",
        "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_2px_8px_-2px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_2px_6px_0_rgba(0,0,0,0.05),0_6px_16px_-4px_rgba(0,0,0,0.06)]",
        selected && "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_6px_20px_-4px_rgba(0,0,0,0.08)] ring-1 ring-ink/20",
      )}
    >
      <NodeResizer
        color="var(--color-ink)"
        isVisible={selected}
        minWidth={240}
        minHeight={160}
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />

      {/* Title bar */}
      <div className="flex shrink-0 items-center gap-2 rounded-t-2xl border-b border-feedback-warning-border/60 bg-feedback-warning-bg/40 px-4 py-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-feedback-warning-bg/60 text-feedback-warning">
          <Container className="size-3.5" />
        </span>
        <input
          defaultValue={label}
          onChange={(e) => updateNodeData(id, { label: e.target.value })}
          placeholder="Section name"
          className="nodrag min-w-0 flex-1 bg-transparent text-[13px] font-semibold tracking-tight text-feedback-warning outline-none placeholder:text-feedback-warning"
        />
        {hasChildren && (
          <span className="rounded-full bg-feedback-warning-bg/60 px-2 py-0.5 text-[10px] font-medium text-feedback-warning">
            {children.length}
          </span>
        )}
        {hasChildren && (
          <button
            onClick={handleGenerateDiagram}
            disabled={diagramBusy}
            className="nodrag flex items-center gap-1 rounded-md bg-feedback-warning-bg/60 px-2 py-0.5 text-[10px] font-medium text-feedback-warning transition-colors hover:bg-feedback-warning-bg/60 disabled:opacity-50"
          >
            {diagramBusy ? <Loader2 className="size-3 animate-spin" /> : <GitBranch className="size-3" />}
            Diagram
          </button>
        )}
        <button
          onClick={() => removeNode(id)}
          title="Remove section (keeps its nodes)"
          aria-label="Remove section (keeps its nodes)"
          className="nodrag grid size-6 shrink-0 place-items-center rounded-md text-feedback-warning opacity-0 transition-all hover:bg-feedback-danger-bg hover:text-feedback-danger group-hover/shell:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Body */}
      {hasChildren ? (
        <div className="flex-1 p-2" />
      ) : (
        <div className="flex min-h-[100px] flex-1 flex-col items-center justify-center px-4 py-4">
          <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-feedback-warning-border/60 px-6 py-5 text-center">
            <Plus className="size-4 text-feedback-warning" />
            <p className="text-[11px] font-medium text-feedback-warning">Add content</p>
            <p className="text-[10px] text-feedback-warning">Drag nodes here or wrap from selection</p>
          </div>
        </div>
      )}
    </div>
  );
}