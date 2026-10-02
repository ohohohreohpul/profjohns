"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useCanvasStore } from "@/store/canvas-store";
import { saveCanvasState } from "@/lib/db/repo";
import { canWriteBoardToServer } from "@/lib/board-lifecycle";

const SAVE_DEBOUNCE_MS = 1200;

/** The canvas-store fields that make up a persisted board (mirror of the
 *  store's `partialize`). Saved as the `state` blob in Supabase. */
function snapshot(): Record<string, unknown> {
  const s = useCanvasStore.getState();
  return {
    direction: s.direction,
    nodes: s.nodes,
    edges: s.edges,
    creditsUsed: s.creditsUsed,
    nextId: s.nextId,
    docs: s.docs,
    sources: s.sources,
    highlights: s.highlights,
    extracts: s.extracts,
    seeded: s.seeded,
    hintSeen: s.hintSeen,
  };
}

/**
 * Save the active canvas board to Supabase (the source of truth when signed
 * in; `loadBoard` reads it first). Every change marks the board `unsynced`
 * until the server confirms the save, so an offline or failed save is kept
 * locally and pushed on the next load instead of being lost. Never writes a
 * placeholder seed over a server board that couldn't be read.
 *
 * No-op when signed out.
 */
export function useCanvasDbSync(canvasId: string, projectId: string): void {
  const { user, enabled } = useAuth();

  React.useEffect(() => {
    if (!enabled || !user || !canvasId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Bumped on every change; a save only clears `unsynced` if nothing changed since.
    let version = 0;
    const ours = () => useCanvasStore.getState().boardCanvasId === canvasId;

    const save = () => {
      if (!ours() || !canWriteBoardToServer(canvasId)) return;
      const saving = version;
      void saveCanvasState(canvasId, projectId, snapshot()).then((ok) => {
        if (ok && saving === version && ours()) useCanvasStore.setState({ unsynced: false });
      });
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, SAVE_DEBOUNCE_MS);
    };

    const unsub = useCanvasStore.subscribe((state, prev) => {
      // Only save once the in-memory board genuinely represents this canvas.
      if (!ours()) return;
      // Opened with edits the server never confirmed: push them now.
      if (state.boardCanvasId !== prev.boardCanvasId) {
        if (state.unsynced) schedule();
        return;
      }
      if (
        state.nodes === prev.nodes &&
        state.edges === prev.edges &&
        state.docs === prev.docs &&
        state.sources === prev.sources &&
        state.highlights === prev.highlights &&
        state.extracts === prev.extracts &&
        state.direction === prev.direction
      ) {
        return;
      }
      version++;
      // A placeholder seed (server unreadable at load) is never authoritative:
      // pushing its edits later could overwrite the real board on the server.
      if (!canWriteBoardToServer(canvasId)) return;
      if (!state.unsynced) useCanvasStore.setState({ unsynced: true });
      schedule();
    });
    // Already loaded before this effect subscribed (fast local load).
    if (ours() && useCanvasStore.getState().unsynced) schedule();
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [user, enabled, canvasId, projectId]);
}
