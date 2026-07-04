"use client";

/**
 * The ONE way to load a canvas board into the singleton canvas store.
 *
 * "Which board is in memory" used to be smeared across three steps
 * (setActiveCanvasId → rehydrate/reset → mark boardCanvasId) that every
 * consumer had to perform correctly by hand. The /doc editor did only the
 * first two — so the persistence gate (which requires the mark) silently
 * dropped every write made there. Centralizing the sequence makes that class
 * of bug impossible: pages call `loadBoard()` and never touch the internals.
 *
 * Contract:
 * - Persistence (localStorage gate + DB sync) only accepts writes once the
 *   in-memory board is marked as representing `canvasId` — which this
 *   function does exactly once, at the correct moment.
 * - Undo history is cleared: a fresh board must not undo into the previous
 *   canvas's state.
 */
import {
  useCanvasStore,
  setActiveCanvasId,
  hasStoredCanvas,
} from "@/store/canvas-store";

export type BoardLoadResult = "restored" | "fresh";

export async function loadBoard(
  canvasId: string,
  opts: { direction?: string } = {},
): Promise<BoardLoadResult> {
  setActiveCanvasId(canvasId);

  if (!canvasId || hasStoredCanvas(canvasId)) {
    // Existing board — rehydrate from its namespaced key. Writes stay blocked
    // (boardCanvasId still names the previous canvas) until the mark below.
    await useCanvasStore.persist.rehydrate();
    useCanvasStore.setState({ boardCanvasId: canvasId });
    useCanvasStore.temporal.getState().clear();
    return "restored";
  }

  // New canvas — seed a fresh board. The single setState marks the board as
  // this canvas's in the same update, so the seed itself is persisted.
  useCanvasStore.getState().reset(opts.direction ?? "");
  useCanvasStore.setState({ hasHydrated: true, boardCanvasId: canvasId });
  useCanvasStore.temporal.getState().clear();
  return "fresh";
}
