"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceSidebar, type SurfaceKey } from "./workspace-sidebar";
import { loadBoard } from "@/lib/board-lifecycle";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useProfileStore } from "@/store/profile-store";
import { PageLoader } from "@/components/brand/page-loader";

/**
 * App shell: persistent navigation sidebar + a surface area. Every surface
 * (Canvas, Library, Media, Links, Agents, Connectors) renders inside this.
 * Rehydrates the canvas store once so derived surfaces have data even when
 * the user lands on them directly.
 */
export function WorkspaceShell({
  active,
  children,
}: {
  active: SurfaceKey;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "";
  const wsHydrated = useWorkspaceStore((s) => s.hasHydrated);
  // Track this project's canvases so derived surfaces (Library/Media/Links) can
  // read the most-recently-used board until backend-side aggregation lands.
  const projectCanvasCount = useWorkspaceStore(
    (s) => s.canvases.filter((c) => c.projectId === projectId).length,
  );

  React.useEffect(() => {
    useWorkspaceStore.persist.rehydrate();
    // The "For You" profile is read on the Discover home; rehydrate it here
    // so it's available wherever the user lands.
    useProfileStore.persist.rehydrate();
  }, []);

  // Load the project's most-recent board through the single lifecycle
  // function (set-active + rehydrate + mark). Rehydrating without the mark
  // (the old code here) left the persistence gate closed — a silent-write-drop
  // trap for any surface that edits the canvas store.
  React.useEffect(() => {
    const latest = useWorkspaceStore
      .getState()
      .canvases.filter((c) => c.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    void loadBoard(latest?.id ?? "");
  }, [projectId, projectCanvasCount]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-grey-50">
      <WorkspaceSidebar active={active} />
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {wsHydrated ? (
          children
        ) : (
          <PageLoader />
        )}
      </div>
    </div>
  );
}

/** Shared header + scroll body for non-canvas surfaces. */
export function SurfaceScaffold({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-grey-200 bg-paper/80 px-6 backdrop-blur">
        <h1 className="text-sm font-semibold tracking-tight text-ink">{title}</h1>
        {description && (
          <p className="min-w-0 truncate text-[12px] text-grey-400">{description}</p>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
