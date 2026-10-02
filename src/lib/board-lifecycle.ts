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
 * - Signed in, the server copy is loaded first (see `chooseBoardSource`).
 */
import {
  useCanvasStore,
  setActiveCanvasId,
  hasStoredCanvas,
  storedCanvasUnsynced,
} from "@/store/canvas-store";
import { readCanvasState } from "@/lib/db/repo";
import { chooseBoardSource } from "@/lib/board-state";

export type BoardLoadResult = "restored" | "fresh";

/**
 * Canvases opened while the server couldn't be read and with no local copy:
 * their in-memory board is a placeholder seed, so it must never be saved
 * over the server's real (but unread) board.
 */
const offlineSeeds = new Set<string>();
/** Each load's ticket: a newer load (another canvas opened meanwhile) wins. */
let latestLoad = 0;

/** Whether the server copy of this board may be overwritten from here. */
export function canWriteBoardToServer(canvasId: string): boolean {
  return !offlineSeeds.has(canvasId);
}

/**
 * Load a canvas board. Signed in, the SERVER is the truth (so edits from
 * another device show up), except for local edits the server never
 * confirmed, which are kept and then pushed by the sync hook.
 */
export async function loadBoard(
  canvasId: string,
  opts: { direction?: string } = {},
): Promise<BoardLoadResult> {
  const ticket = ++latestLoad;
  setActiveCanvasId(canvasId);
  offlineSeeds.delete(canvasId);
  const hasLocal = !canvasId || hasStoredCanvas(canvasId);
  const localUnsynced = Boolean(canvasId) && storedCanvasUnsynced(canvasId);
  // Unsynced local edits win, so don't wait on the server for them.
  const server = canvasId && !(hasLocal && localUnsynced) ? await readCanvasState(canvasId) : ({ status: "signed-out" } as const);
  // Another canvas was opened while we waited: that load owns the store now.
  if (ticket !== latestLoad) return "restored";

  const source = chooseBoardSource({ hasLocal, localUnsynced, server });

  if (source === "server" && server.status === "ok") {
    // Apply, then mark in a second update: the mark's setState opens the
    // persistence gate, so the server copy also becomes the local copy.
    useCanvasStore.setState({ ...server.state, unsynced: false });
    useCanvasStore.setState({ hasHydrated: true, boardCanvasId: canvasId });
    useCanvasStore.temporal.getState().clear();
    return "restored";
  }

  if (source === "local") {
    // Writes stay blocked (boardCanvasId still names the previous canvas)
    // until the mark below, so rehydrating can't write into another board.
    await useCanvasStore.persist.rehydrate();
    useCanvasStore.setState({ boardCanvasId: canvasId });
    useCanvasStore.temporal.getState().clear();
    return "restored";
  }

  // Fresh seed. Offline: keep it off the server, whose board we couldn't read.
  if (source === "seed-offline") offlineSeeds.add(canvasId);
  useCanvasStore.getState().reset(opts.direction ?? "");
  useCanvasStore.setState({ hasHydrated: true, boardCanvasId: canvasId, unsynced: false });
  useCanvasStore.temporal.getState().clear();
  return "fresh";
}
