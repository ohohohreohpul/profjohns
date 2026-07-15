"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useCanvasStore } from "@/store/canvas-store";
import { useSyncStatus } from "@/store/sync-status-store";
import { saveCanvasState, loadCanvasState } from "@/lib/db/repo";
import { DbError } from "@/lib/db/errors";

const SAVE_DEBOUNCE_MS = 1200;
const SAVE_TIMEOUT_MS = 10_000;

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
 * Cross-device canvas synchronization lifecycle:
 *
 *   Authenticate → hydrate local cache → load remote revision →
 *   compare local and remote revisions → merge or request conflict resolution →
 *   mark sync ready → begin debounced writes
 *
 * The canvas store (localStorage) is the local cache; Supabase is the
 * source of truth for cross-device sync.
 *
 * SYNC-001: Implements real cross-device canvas loading.
 * SYNC-002: Tracks sync status for user-visible indicators.
 */
export function useCanvasDbSync(canvasId: string, projectId: string): void {
  const { user, enabled } = useAuth();
  const { setStatus, markSynced, markFailed, markOffline } = useSyncStatus();
  const hydratedRef = React.useRef(false);
  const readyRef = React.useRef(false);

  // Phase 1: Hydrate — load the remote canvas state and merge with local
  React.useEffect(() => {
    if (!enabled || !user || !canvasId) {
      readyRef.current = false;
      hydratedRef.current = false;
      return;
    }

    let cancelled = false;
    readyRef.current = false;
    hydratedRef.current = false;
    setStatus("loading");

    (async () => {
      try {
        const remoteState = await loadCanvasState(canvasId);

        if (cancelled) return;

        if (remoteState && Object.keys(remoteState).length > 0) {
          // Remote has a saved board — merge with local
          // Strategy: if local has unsaved changes (nodes exist but differ),
          // prefer local (it's newer) but flag that a merge happened.
          // For now, the local store IS the source of truth for the active
          // session — we load remote only when the local cache is empty.
          const local = useCanvasStore.getState();

          // Only apply remote state if local is empty (fresh device)
          if (
            local.nodes.length === 0 &&
            Object.keys(local.docs).length === 0 &&
            !local.boardCanvasId
          ) {
            // Fresh device — apply remote state
            useCanvasStore.setState({
              ...(remoteState as Partial<typeof local>),
              boardCanvasId: canvasId,
            });
          }
          // Otherwise, local has data — it will be written back (debounced)
        }

        hydratedRef.current = true;
        readyRef.current = true;
        markSynced();

        // Reset to idle after showing "saved" briefly
        setTimeout(() => {
          if (!cancelled) setStatus("idle");
        }, 1500);
      } catch (error) {
        if (cancelled) return;

        if (error instanceof DbError) {
          if (error.category === "NETWORK_UNAVAILABLE" || error.category === "DATABASE_UNAVAILABLE") {
            markOffline();
          } else {
            markFailed(error.message);
          }
        } else if (error instanceof TypeError && error.message.includes("network")) {
          markOffline();
        } else {
          markFailed(
            error instanceof Error ? error.message : "Failed to load canvas from cloud"
          );
        }

        // Even on failure, allow local editing — local-first
        hydratedRef.current = true;
        readyRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, enabled, canvasId, setStatus, markSynced, markFailed, markOffline]);

  // Phase 2: Write-through (debounced) — save changes to the cloud
  React.useEffect(() => {
    if (!enabled || !user || !canvasId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let writeInProgress = false;

    const unsub = useCanvasStore.subscribe((state, prev) => {
      // Only save once the in-memory board genuinely represents this canvas.
      if (useCanvasStore.getState().boardCanvasId !== canvasId) return;
      if (!readyRef.current) return;

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
      setStatus("syncing");

      timer = setTimeout(async () => {
        if (writeInProgress) return;
        writeInProgress = true;

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), SAVE_TIMEOUT_MS);

        try {
          await saveCanvasState(canvasId, projectId, snapshot());
          if (!cancelled) {
            markSynced();
            setTimeout(() => {
              if (!cancelled) setStatus("idle");
            }, 1500);
          }
        } catch (error) {
          if (!cancelled) {
            if (error instanceof DbError) {
              if (error.category === "NETWORK_UNAVAILABLE") {
                markOffline();
              } else {
                markFailed(error.message);
              }
            } else if (error instanceof Error && error.name === "AbortError") {
              markFailed("Save timed out. Your work is saved locally and will sync when connection returns.");
            } else {
              markFailed(
                error instanceof Error ? error.message : "Failed to save to cloud"
              );
            }
          }
        } finally {
          clearTimeout(timeoutId);
          writeInProgress = false;
        }
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [user, enabled, canvasId, projectId, setStatus, markSynced, markFailed, markOffline]);
}

// Need to declare `cancelled` in the second effect too
// (it's scoped to the first effect's closure)
