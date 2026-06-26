"use client";

import { useWorkspaceSync } from "@/lib/sync/use-workspace-sync";

/**
 * Mounted once under AuthProvider — keeps the workspace (projects, canvases,
 * pinned sources, settings) synced to Supabase for the signed-in user. Renders
 * nothing. Canvas board state syncs separately on the canvas page.
 */
export function PersistenceSync() {
  useWorkspaceSync();
  return null;
}
