"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useCanvasStore } from "@/store/canvas-store";
import { loadCanvasState, saveCanvasState } from "@/lib/db/repo";

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
 * Phase 1 — sync one canvas board's state with Supabase. When signed in and
 * the DB already has this board, the DB copy wins (applied after the page's
 * local hydration); edits then save back debounced. No-op when signed out.
 */
export function useCanvasDbSync(canvasId: string, projectId: string): void {
  const { user, loading, enabled } = useAuth();
  const suppress = React.useRef(false);
  const applied = React.useRef<string | null>(null);

  // Pull the DB copy once per canvas (DB is source of truth when present).
  React.useEffect(() => {
    if (!enabled || loading || !user || !canvasId) return;
    if (applied.current === canvasId) return;
    let cancelled = false;
    (async () => {
      const state = await loadCanvasState(canvasId);
      if (cancelled) return;
      applied.current = canvasId;
      if (state) {
        suppress.current = true;
        useCanvasStore.setState({ ...state, hasHydrated: true });
        suppress.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, enabled, canvasId]);

  // Save board edits back, debounced.
  React.useEffect(() => {
    if (!enabled || !user || !canvasId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (suppress.current) return;
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
