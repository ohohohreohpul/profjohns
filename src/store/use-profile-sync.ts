"use client";

import * as React from "react";
import { useCanvasStore } from "./canvas-store";
import { useWorkspaceStore } from "./workspace-store";
import {
  useProfileStore,
  buildInterestProfile,
  applyFeedback,
} from "./profile-store";
import type { PaperSource } from "@/lib/mock";

/**
 * Rebuilds the "For You" interest profile from local signals whenever the
 * current canvas's kept sources change, and persists it to profile-store so
 * the home Discover tab can query OpenAlex by concept. No AI calls.
 *
 * v1 derives from the current canvas + all project directions; cross-canvas
 * aggregation arrives with VISION P1 (server-side profile).
 */
export function useProfileSync(): void {
  const sources = useCanvasStore((s) => s.sources);
  const nodes = useCanvasStore((s) => s.nodes);
  const hasHydrated = useCanvasStore((s) => s.hasHydrated);
  const projects = useWorkspaceStore((s) => s.projects);
  const wsHydrated = useWorkspaceStore((s) => s.hasHydrated);
  const setProfile = useProfileStore((s) => s.setProfile);
  const feedback = useProfileStore((s) => s.feedback);

  React.useEffect(() => {
    if (!hasHydrated || !wsHydrated) return;

    // Gather kept sources across all source nodes on this canvas.
    const kept: PaperSource[] = [];
    for (const list of Object.values(sources)) {
      for (const p of list) kept.push(p);
    }

    // Project directions + scout (explorer) topics as keyword signals.
    const directions = projects.map((p) => p.direction).filter(Boolean);
    const topics = nodes
      .filter((n) => n.data.kind === "explorer" && typeof n.data.topic === "string")
      .map((n) => n.data.topic as string)
      .filter(Boolean);

    if (kept.length === 0 && directions.length === 0 && topics.length === 0) {
      return;
    }

    const base = buildInterestProfile({ sources: kept, directions, topics });
    const reweighted = applyFeedback(base, feedback);
    setProfile(reweighted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, nodes, hasHydrated, projects, wsHydrated, feedback, setProfile]);
}
