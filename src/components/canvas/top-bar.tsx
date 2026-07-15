"use client";

import Link from "next/link";
import {
  Coins,
  Download,
  ArrowCounterClockwise as Undo2,
  ArrowClockwise as Redo2,
  Layout as PanelsTopLeft,
  Graph as Network,
  Books as Library,
  Image as ImageIcon,
  Link as Link2,
  Robot as Bot,
  Plug,
  ArrowLeft,
  DotsThree,
  Eraser,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import Image from "next/image";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useCanvasStore, clearStoredCanvas } from "@/store/canvas-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTemporal } from "@/store/use-temporal";
import { clearCanvasState } from "@/lib/db/repo";

const PROJECT_SURFACES = [
  { label: "Canvases", href: "/canvases", icon: Network },
  { label: "Library", href: "/library", icon: Library },
  { label: "Media", href: "/media", icon: ImageIcon },
  { label: "Links", href: "/links", icon: Link2 },
] as const;

const WORKSPACE_SURFACES = [
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Connectors", href: "/mcp", icon: Plug },
] as const;

function SurfacesMenu({ projectId }: { projectId: string }) {
  const q = projectId ? `?project=${projectId}` : "";
  const item =
    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-grey-700 transition-colors hover:bg-grey-100 hover:text-ink";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Go to a surface"
          title="Surfaces"
          className="grid size-8 place-items-center rounded-md text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <PanelsTopLeft className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-48 p-1">
        <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-grey-500">
          This project
        </p>
        {PROJECT_SURFACES.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={`${s.href}${q}`} className={item}>
              <Icon className="size-4 shrink-0 text-grey-500" />
              {s.label}
            </Link>
          );
        })}
        <Separator className="my-1" />
        <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-grey-500">
          Workspace
        </p>
        {WORKSPACE_SURFACES.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={`${s.href}${q}`} className={item}>
              <Icon className="size-4 shrink-0 text-grey-500" />
              {s.label}
            </Link>
          );
        })}
        <Separator className="my-1" />
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12px] text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <ArrowLeft className="size-4 shrink-0" />
          All projects
        </Link>
      </PopoverContent>
    </Popover>
  );
}

async function resetBoard(canvasId: string, direction: string) {
  if (!canvasId) return;
  if (
    !confirm(
      "Reset this board? It clears this canvas's contents and starts fresh. This can't be undone.",
    )
  ) {
    return;
  }
  clearStoredCanvas(canvasId); // remove the local board blob
  useCanvasStore.getState().reset(direction); // fresh seed in memory
  useCanvasStore.setState({ hasHydrated: true, boardCanvasId: canvasId });
  await clearCanvasState(canvasId); // wipe the DB copy (no-op signed out)
}

function BoardMenu({
  canvasId,
  direction,
}: {
  canvasId: string;
  direction: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Board options"
          title="Board options"
          className="grid size-8 place-items-center rounded-md text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <DotsThree className="size-4" weight="bold" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-56 p-1">
        <button
          onClick={() => void resetBoard(canvasId, direction)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-grey-700 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Eraser className="size-4 shrink-0" />
          Reset board
        </button>
        <p className="px-2 pb-1 pt-0.5 text-[10.5px] leading-snug text-grey-500">
          Clears this canvas and starts fresh — use if a board shows the wrong
          contents.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function exportCanvas() {
  const s = useCanvasStore.getState();
  const snapshot = {
    direction: s.direction,
    nodes: s.nodes,
    edges: s.edges,
    docs: s.docs,
    sources: s.sources,
    highlights: s.highlights,
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lattice-canvas.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function TopBar({
  direction,
  creditsUsed,
  projectId = "",
  canvasId = "",
}: {
  direction: string;
  creditsUsed: number;
  projectId?: string;
  canvasId?: string;
}) {
  const { canUndo, canRedo, undo, redo } = useTemporal();
  const project = useWorkspaceStore((s) =>
    s.projects.find((p) => p.id === projectId),
  );

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-12 items-center gap-2 border-b border-grey-200 bg-paper px-3">
      <SurfacesMenu projectId={projectId} />
      <Link href="/" className="flex shrink-0 items-center gap-0">
        <ProfJohnsLogo size={48} className="shrink-0 -mr-1" />
        <object
          data="/profjohns-text.svg"
          type="image/svg+xml"
          className="h-[22px] w-auto"
          aria-label="ProfJohns"
        />
      </Link>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      <div className="flex shrink-0 items-center">
        <button
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (⌘Z)"
          className="grid size-8 place-items-center rounded-md text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink disabled:opacity-30"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (⌘⇧Z)"
          className="grid size-8 place-items-center rounded-md text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink disabled:opacity-30"
        >
          <Redo2 className="size-4" />
        </button>
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Breadcrumb — click the project name to return to its Space. */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {project && projectId && (
          <>
            <Link
              href={`/canvases?project=${projectId}`}
              title="Back to project"
              className="max-w-[180px] shrink-0 truncate text-sm font-medium text-ink transition-colors hover:text-grey-600"
            >
              {project.name || "Untitled project"}
            </Link>
            <span className="shrink-0 text-grey-500">/</span>
          </>
        )}
        <p className="min-w-0 truncate text-sm text-grey-500">
          {direction || "Canvas"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          title="Illustrative estimate — not billed"
          className="flex items-center gap-1.5 rounded-md border border-grey-200 bg-grey-50 px-2.5 py-1 text-xs font-medium text-grey-700"
        >
          <Coins className="size-3.5 text-grey-500" />
          ~{creditsUsed} credits (est.)
        </span>
        <Button size="sm" variant="outline" onClick={exportCanvas}>
          <Download className="size-3.5" />
          Export canvas
        </Button>
        <BoardMenu canvasId={canvasId} direction={direction} />
      </div>
    </header>
  );
}
