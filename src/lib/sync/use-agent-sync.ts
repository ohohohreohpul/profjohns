"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useAgentStore } from "@/store/agent-store";
import { loadAgents, reconcileAgents } from "@/lib/db/repo";
import { mergeById } from "@/lib/sync/merge-workspace";

const WRITE_DEBOUNCE_MS = 1200;

/**
 * Keep the agent library synced with Supabase for the signed-in user
 * (VISION Phase 2). Same shape as `useWorkspaceSync`: MERGE the DB snapshot
 * with local (never blind-replace), push local-only + locally-newer up, then
 * write-through on change. Built-ins seed at a fixed epoch (see agent-store),
 * so an unedited default never clobbers a cross-device edit. No-op signed out.
 */
export function useAgentSync(): void {
  const { user, loading, enabled } = useAuth();
  const suppress = React.useRef(false);
  const ready = React.useRef(false);

  React.useEffect(() => {
    ready.current = false;
    if (!enabled || loading || !user) return;
    let cancelled = false;

    (async () => {
      // Make sure built-ins + any local customs are in memory before merging.
      await useAgentStore.persist.rehydrate();
      const db = await loadAgents();
      if (cancelled || !db) return;
      const local = useAgentStore.getState().agents;

      const { merged, dirty } = mergeById(db, local);
      suppress.current = true;
      useAgentStore.setState({ agents: merged });
      suppress.current = false;

      // Anything local the DB didn't have (or newer) goes up now, not on the
      // next debounce (which a quick reload would kill).
      if (dirty) await reconcileAgents(merged);
      if (!cancelled) ready.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, enabled]);

  React.useEffect(() => {
    if (!enabled || !user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useAgentStore.subscribe((state, prev) => {
      if (suppress.current || !ready.current) return;
      if (state.agents === prev.agents) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void reconcileAgents(useAgentStore.getState().agents);
      }, WRITE_DEBOUNCE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [user, enabled]);
}
