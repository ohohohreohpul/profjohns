"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useBoard } from "./use-board";
import { WallColumn } from "./wall-column";

interface BoardViewProps {
  readonly projectId: string;
  readonly boardId: string;
}

/** The v2 board: titled walls of cards, loaded from the server. */
export function BoardView({ projectId, boardId }: BoardViewProps) {
  const project = useWorkspaceStore((s) => s.projects.find((p) => p.id === projectId));
  const canvas = useWorkspaceStore((s) => s.canvases.find((c) => c.id === boardId));
  const projectName = project?.name ?? "Untitled project";
  const boardName = canvas?.name ?? "Board";

  const board = useBoard({ boardId, projectId, boardName, projectName });

  return (
    <main className="flex h-dvh flex-col bg-canvas">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-grey-200 bg-paper px-4">
        <Link
          href={`/canvases?project=${encodeURIComponent(projectId)}`}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          <span className="max-w-60 truncate">{projectName}</span>
        </Link>
        <span aria-hidden className="text-grey-300">/</span>
        <h1 className="font-display truncate text-sm font-semibold text-ink">{boardName}</h1>
      </header>

      {board.status === "loading" && (
        <div role="status" className="flex flex-1 items-center justify-center text-sm text-grey-600">
          Opening board…
        </div>
      )}

      {board.status === "error" && (
        <div role="alert" className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm rounded-xl border border-feedback-danger-border bg-feedback-danger-bg p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-feedback-danger">
              <WarningCircle className="size-4 shrink-0" />
              {board.message}
            </p>
            <button
              type="button"
              onClick={board.reload}
              className="mt-3 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-grey-800"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {board.status === "ready" && (
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-6 py-5">
          {board.snapshot.walls.map((wall) => (
            <WallColumn
              key={wall.id}
              wall={wall}
              cards={board.snapshot.cards.filter((c) => c.wallId === wall.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
