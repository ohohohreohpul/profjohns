"use client";

import * as React from "react";
import { useReactFlow } from "@xyflow/react";
import { CaretLeft as ChevronLeft, X } from "@phosphor-icons/react";
import { useCanvasStore } from "@/store/canvas-store";

export function FocusOverlay() {
  const focusedShellId = useCanvasStore((s) => s.focusedShellId);
  const unfocusShell = useCanvasStore((s) => s.unfocusShell);
  const nodes = useCanvasStore((s) => s.nodes);
  const { fitView } = useReactFlow();

  const shell = nodes.find((n) => n.id === focusedShellId);
  const label = (shell?.data as Record<string, unknown>)?.label as string | undefined;

  // Zoom to fit the focused shell + its children
  React.useEffect(() => {
    if (!focusedShellId) return;
    const targetIds = [focusedShellId];
    // Include children
    for (const n of nodes) {
      if (n.parentId === focusedShellId) targetIds.push(n.id);
    }
    const targets = nodes.filter((n) => targetIds.includes(n.id));
    if (targets.length > 0) {
      const timer = setTimeout(() => {
        fitView({ nodes: targets, padding: 0.25, duration: 400, maxZoom: 2 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [focusedShellId, nodes, fitView]);

  // Escape to unfocus
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") unfocusShell();
    }
    if (focusedShellId) {
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }
  }, [focusedShellId, unfocusShell]);

  if (!focusedShellId || !shell) return null;

  return (
    <div className="animate-surface-in fixed inset-0 z-30 flex flex-col bg-ink/40">
      {/* Breadcrumb bar */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-grey-200 bg-paper px-4">
        <button
          onClick={unfocusShell}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <ChevronLeft className="size-4" />
          Canvas
        </button>
        <span className="text-xs text-grey-400">/</span>
        <span className="flex items-center gap-1 rounded-lg bg-amber-100/60 px-2.5 py-1 text-xs font-semibold text-amber-900">
          {label ?? "Untitled section"}
        </span>
        <div className="flex-1" />
        <button
          onClick={unfocusShell}
          className="grid size-8 place-items-center rounded-lg text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Transparent body — clicks pass through to canvas below */}
      <div className="flex-1" />
    </div>
  );
}