"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  loadWorkspace,
  reconcileProjects,
  reconcileCanvases,
  reconcilePinned,
  saveSettings,
} from "@/lib/db/repo";

const WRITE_DEBOUNCE_MS = 1200;

/**
 * Phase 1 — keep the workspace store (projects, canvases-meta, pinned sources,
 * Lily's style profile, Discover interests) synced with Supabase for the
 * signed-in user. localStorage stays as the offline cache; the DB is the
 * source of truth. No-op when signed out.
 */
export function useWorkspaceSync(): void {
  const { user, loading, enabled } = useAuth();
  const suppress = React.useRef(false); // don't write back what we just pulled
  const ready = React.useRef(false);

  // Hydrate from the DB (or migrate local → DB on first login).
  React.useEffect(() => {
    ready.current = false;
    if (!enabled || loading || !user) return;
    let cancelled = false;

    (async () => {
      const snap = await loadWorkspace();
      if (cancelled || !snap) return;
      const local = useWorkspaceStore.getState();

      if (snap.projects.length === 0 && local.projects.length > 0) {
        // First login carrying existing local data → push it up.
        await reconcileProjects(local.projects);
        await reconcileCanvases(local.canvases);
        await reconcilePinned(local.pinnedSources);
        await saveSettings({
          styleProfile: local.styleProfile,
          homeInterests: local.homeInterests,
        });
      } else {
        // DB is source of truth → apply to the store.
        suppress.current = true;
        useWorkspaceStore.setState({
          projects: snap.projects,
          canvases: snap.canvases,
          pinnedSources: snap.pinnedSources,
          ...(snap.styleProfile !== null ? { styleProfile: snap.styleProfile } : {}),
          ...(snap.homeInterests && snap.homeInterests.length
            ? { homeInterests: snap.homeInterests }
            : {}),
        });
        suppress.current = false;
      }
      if (!cancelled) ready.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, enabled]);

  // Write-through (debounced) on persisted-slice changes.
  React.useEffect(() => {
    if (!enabled || !user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsub = useWorkspaceStore.subscribe((state, prev) => {
      if (suppress.current || !ready.current) return;
      const changed =
        state.projects !== prev.projects ||
        state.canvases !== prev.canvases ||
        state.pinnedSources !== prev.pinnedSources ||
        state.styleProfile !== prev.styleProfile ||
        state.homeInterests !== prev.homeInterests;
      if (!changed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const s = useWorkspaceStore.getState();
        void reconcileProjects(s.projects);
        void reconcileCanvases(s.canvases);
        void reconcilePinned(s.pinnedSources);
        void saveSettings({
          styleProfile: s.styleProfile,
          homeInterests: s.homeInterests,
        });
      }, WRITE_DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [user, enabled]);
}
