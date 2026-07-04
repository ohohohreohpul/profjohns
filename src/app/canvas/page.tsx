"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CursorClick as MousePointerClick, Plus } from "@phosphor-icons/react";
import { ResearchCanvas } from "@/components/canvas/research-canvas";
import { TopBar } from "@/components/canvas/top-bar";
import { SurfaceOverlay } from "@/components/canvas/surfaces/surface-overlay";
import { ReaderSurface } from "@/components/canvas/surfaces/reader-surface";
import { CinematicPreloader } from "@/components/onboarding/cinematic-preloader";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import { useCanvasStore } from "@/store/canvas-store";
import { loadBoard } from "@/lib/board-lifecycle";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useProfileSync } from "@/store/use-profile-sync";
import { useCanvasDbSync } from "@/lib/sync/use-canvas-db-sync";
import { parseSourcesParam } from "@/components/home/hero-sources-popover";
import { cn } from "@/lib/utils";

function Loader() {
  return (
    <div className="flex size-full items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <ProfJohnsLogo size={32} className="animate-wordmark" />
      </div>
    </div>
  );
}

function BlankCta() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="animate-cta-enter flex flex-col items-center gap-2 rounded-xl border border-grey-200 bg-paper/80 px-6 py-4 text-center shadow-lift backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-grey-500">
            <MousePointerClick className="size-4" />
            <span className="text-xs">Right-click</span>
          </div>
          <span className="text-xs text-grey-300">or</span>
          <div className="flex items-center gap-1.5 text-grey-500">
            <Plus className="size-4" />
            <span className="text-xs">Toolbar</span>
          </div>
        </div>
        <p className="text-xs text-grey-400">to add your first node</p>
      </div>
    </div>
  );
}

function CanvasWorkspace() {
  const searchParams = useSearchParams();
  const direction = searchParams.get("direction") ?? "";
  const projectId = searchParams.get("project") ?? "";
  const canvasId = searchParams.get("canvas") ?? "";
  const launchTopic = searchParams.get("topic") ?? "";
  const launchSources = parseSourcesParam(searchParams.get("sources"));

  // Keep the "For You" interest profile in sync with kept sources on this
  // canvas — no AI; a weighted tally of concepts + keywords.
  useProfileSync();

  // Phase 1 — sync this board's state with Supabase when signed in (no-op otherwise).
  useCanvasDbSync(canvasId, projectId);

  const reset = useCanvasStore((s) => s.reset);
  const storedDirection = useCanvasStore((s) => s.direction);
  const creditsUsed = useCanvasStore((s) => s.creditsUsed);
  const hasHydrated = useCanvasStore((s) => s.hasHydrated);
  const seeded = useCanvasStore((s) => s.seeded);
  const nodes = useCanvasStore((s) => s.nodes);
  const openSurfaceNodeId = useCanvasStore((s) => s.openSurfaceNodeId);
  const readerPaper = useCanvasStore((s) => s.readerPaper);
  const updateProject = useWorkspaceStore((s) => s.updateProject);
  const updateCanvas = useWorkspaceStore((s) => s.updateCanvas);
  const wsHydrated = useWorkspaceStore((s) => s.hasHydrated);

  // The board mutates the workspace store (names, item counts) — hydrate it
  // first so those writes never clobber persisted projects/canvases.
  React.useEffect(() => {
    useWorkspaceStore.persist.rehydrate();
  }, []);

  // Expose the project context so canvas nodes (e.g. the Library node) can
  // pull project-level data.
  React.useEffect(() => {
    useCanvasStore.getState().setProjectId(projectId);
  }, [projectId]);

  // Sync project name when canvas direction changes
  React.useEffect(() => {
    if (!wsHydrated) return;
    if (projectId && storedDirection) {
      updateProject(projectId, { direction: storedDirection });
    }
  }, [wsHydrated, projectId, storedDirection, updateProject]);

  // Update item counts when nodes change
  React.useEffect(() => {
    if (!wsHydrated) return;
    if (projectId && nodes.length > 0) {
      updateProject(projectId, { itemCount: nodes.length, updatedAt: Date.now() });
    }
    if (canvasId) {
      updateCanvas(canvasId, { itemCount: nodes.length });
    }
  }, [wsHydrated, projectId, canvasId, nodes.length, updateProject, updateCanvas]);

  // Load this canvas's board via the ONE lifecycle function — it owns
  // set-active → rehydrate/seed → mark-loaded → clear-undo, so no page can
  // half-perform the sequence (the class of bug behind boards leaking across
  // canvases and the doc editor dropping writes).
  React.useEffect(() => {
    void loadBoard(canvasId, { direction }).then((result) => {
      // Launched from the Discover hero — seed the Sources scout's topic
      // and constrain it to the user's selected source providers.
      if (result === "fresh" && launchTopic) {
        const st = useCanvasStore.getState();
        const explorer = st.nodes.find((n) => n.data.kind === "explorer");
        if (explorer) {
          st.updateNodeData(explorer.id, {
            topic: launchTopic,
            ...(launchSources ? { allowedSources: launchSources } : {}),
          });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  // Clean up old canvas data from previous versions — resets if stale node types found
  React.useEffect(() => {
    if (!hasHydrated) return;
    const state = useCanvasStore.getState();
    const validKinds = ["explorer", "processor", "block", "text", "shell", "writing", "assistant", "paper", "media", "library", "link"];
    const hasStale = state.nodes.some(
      (n) => !validKinds.includes(n.data.kind),
    );
    if (hasStale && state.nodes.length > 0) {
      // Old data detected — clear and re-seed
      localStorage.removeItem("lattice-canvas-v1");
      reset(direction || state.direction);
    }
  }, [hasHydrated, direction, reset]);

  React.useEffect(() => {
    const state = useCanvasStore.getState();
    if (hasHydrated && !state.seeded && state.nodes.length === 0) {
      reset(direction);
      if (projectId && direction) {
        updateProject(projectId, { direction, updatedAt: Date.now() });
      }
    }
  }, [hasHydrated, direction, reset, projectId, updateProject]);

  React.useEffect(() => {
    if (!hasHydrated) return;
    const t = setTimeout(
      () => useCanvasStore.temporal.getState().clear(),
      700,
    );
    return () => clearTimeout(t);
  }, [hasHydrated]);

  const [preloaderDone, setPreloaderDone] = React.useState(false);
  const [ssrDone, setSsrDone] = React.useState(false);

  React.useEffect(() => {
    setSsrDone(true);
  }, []);

  const showPreloader =
    ssrDone &&
    !preloaderDone &&
    !sessionStorage.getItem("profjohns-preloader-shown");

  React.useEffect(() => {
    if (preloaderDone) {
      sessionStorage.setItem("profjohns-preloader-shown", "1");
    }
  }, [preloaderDone]);

  if (showPreloader && !hasHydrated) {
    return (
      <CinematicPreloader
        direction={direction || storedDirection || "Setting up your canvas"}
        onComplete={() => setPreloaderDone(true)}
      />
    );
  }

  if (!hasHydrated) {
    return <Loader />;
  }

  const surfaceOpen = !!openSurfaceNodeId || !!readerPaper;
  const isBlank = nodes.length === 0 && seeded;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <TopBar
        direction={storedDirection || direction}
        creditsUsed={creditsUsed}
        projectId={projectId}
        canvasId={canvasId}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 top-12",
          surfaceOpen && "canvas-behind-surface",
        )}
      >
        {/* Key by canvas id so switching boards remounts the flow + nodes —
            no leftover per-node local state (e.g. a typed search term) leaks
            from the previous canvas. */}
        <ResearchCanvas key={canvasId} />
        {isBlank && <BlankCta />}
      </div>
      <SurfaceOverlay />
      <ReaderSurface />
    </main>
  );
}

export default function CanvasPage() {
  return (
    <React.Suspense fallback={<Loader />}>
      <CanvasWorkspace />
    </React.Suspense>
  );
}