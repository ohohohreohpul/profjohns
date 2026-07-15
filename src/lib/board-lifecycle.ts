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
import { loadCanvasState } from "@/lib/db/repo";
import { sanitizeBoardState } from "@/lib/board-state";

export type BoardLoadResult = "restored" | "fresh";

export async function loadBoard(
  canvasId: string,
  opts: { direction?: string } = {},
): Promise<BoardLoadResult> {
  setActiveCanvasId(canvasId);

  if (!canvasId || hasStoredCanvas(canvasId)) {
    // Existing local board — rehydrate from its namespaced key. Local ALWAYS
    // wins when present; the DB is never consulted here (that override race
    // was the original canvases-share-a-board bug). Writes stay blocked
    // (boardCanvasId still names the previous canvas) until the mark below.
    await useCanvasStore.persist.rehydrate();
    useCanvasStore.setState({ boardCanvasId: canvasId });
    useCanvasStore.temporal.getState().clear();
    return "restored";
  }

  // Local miss — cross-device read: this canvas may have a board saved from
  // another device/browser. No-op (null) when signed out or unconfigured.
  try {
    const dbState = sanitizeBoardState(await loadCanvasState(canvasId));
    if (dbState) {
      // Apply, then mark in a second update: the mark's setState triggers the
      // (now-open) persistence gate, which writes the whole board to this
      // canvas's localStorage key — the DB copy becomes the local copy.
      useCanvasStore.setState(dbState);
      useCanvasStore.setState({ hasHydrated: true, boardCanvasId: canvasId });
      useCanvasStore.temporal.getState().clear();
      return "restored";
    }
  } catch {
    // DB unreachable — fall through to a fresh seed; the board will sync up
    // once the connection returns.
  }

  // Genuinely new canvas — seed a fresh board. The single setState marks the
  // board as this canvas's in the same update, so the seed itself persists.
  useCanvasStore.getState().reset(opts.direction ?? "");
  useCanvasStore.setState({ hasHydrated: true, boardCanvasId: canvasId });
  useCanvasStore.temporal.getState().clear();
  return "fresh";
}
