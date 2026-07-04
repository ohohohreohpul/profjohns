"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Graph as Network } from "@phosphor-icons/react";
import { useCanvasStore } from "@/store/canvas-store";
import { loadBoard } from "@/lib/board-lifecycle";
import { useWorkspaceStore } from "@/store/workspace-store";
import { WritingDocument } from "@/components/canvas/surfaces/writing-document";

function Loader() {
  return (
    <div className="grid h-dvh place-items-center bg-grey-50">
      <p className="animate-wordmark text-sm font-medium tracking-display text-grey-300">
        ProfJohns
      </p>
    </div>
  );
}

/**
 * Full-page document editor — a clean writing surface (no canvas, no sidebar).
 * Edits the SAME doc as the canvas Draft node (shared via the canvas store,
 * keyed by node id within its canvas), so writing here ⇄ writing on the board.
 */
export function DocEditor() {
  const sp = useSearchParams();
  const projectId = sp.get("project") ?? "";
  const canvasId = sp.get("canvas") ?? "";
  const node = sp.get("node") ?? "";

  const hasHydrated = useCanvasStore((s) => s.hasHydrated);
  const project = useWorkspaceStore((s) =>
    s.projects.find((p) => p.id === projectId),
  );

  React.useEffect(() => {
    useWorkspaceStore.persist.rehydrate();
  }, []);

  // Load the board through the single lifecycle function. The previous
  // hand-rolled version set the active id and rehydrated but never MARKED the
  // board as loaded — so the persistence gate silently dropped every edit
  // made on this page. loadBoard owns the full sequence.
  React.useEffect(() => {
    void loadBoard(canvasId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  if (!hasHydrated) return <Loader />;

  return (
    <div className="min-h-dvh bg-grey-50">
      <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-grey-200 bg-paper/80 px-4 backdrop-blur">
        <Link
          href={`/library?project=${projectId}`}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Library
        </Link>
        {project && (
          <span className="truncate text-[13px] text-grey-400">{project.name}</span>
        )}
        {canvasId && (
          <Link
            href={`/canvas?project=${projectId}&canvas=${canvasId}`}
            className="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
            title="Open on the canvas"
          >
            <Network className="size-3.5" />
            On canvas
          </Link>
        )}
      </header>

      <div className="px-6 py-10">
        {node ? (
          <WritingDocument nodeId={node} direction="" />
        ) : (
          <p className="mx-auto max-w-2xl text-center text-sm text-grey-400">
            Document not found.
          </p>
        )}
      </div>
    </div>
  );
}
