"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useCanvasStore } from "@/store/canvas-store";
import { saveCanvasState } from "@/lib/db/repo";

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
 * Phase 1 — back the active canvas board up to Supabase, WRITE-ONLY.
 *
 * localStorage (the canvas store's namespaced persist) is the single source of
 * truth for a board. We deliberately do NOT read the board back from the DB:
 * doing so raced with local hydration and could override the correct board,
 * which made canvases appear to share one board / a new canvas open an old one.
 * The DB copy is a best-effort backup; cross-device board READ will be a
 * separate, properly-built step. The save is gated on `boardCanvasId` so a
 * board is only ever written to the canvas it actually represents.
 *
 * No-op when signed out.
 */
export function useCanvasDbSync(canvasId: string, projectId: string): void {
  const { user, enabled } = useAuth();

  React.useEffect(() => {
    if (!enabled || !user || !canvasId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useCanvasStore.subscribe((state, prev) => {
      // Only save once the in-memory board genuinely represents this canvas.
      if (useCanvasStore.getState().boardCanvasId !== canvasId) return;
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
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void saveCanvasState(canvasId, projectId, snapshot());
      }, SAVE_DEBOUNCE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [user, enabled, canvasId, projectId]);
}
