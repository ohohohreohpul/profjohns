"use client";

import { useWorkspaceSync } from "@/lib/sync/use-workspace-sync";
import { useAgentSync } from "@/lib/sync/use-agent-sync";

/**
 * Mounted once under AuthProvider — keeps the workspace (projects, canvases,
 * pinned sources, settings) and the agent library synced to Supabase for the
 * signed-in user. Renders nothing. Canvas board state syncs separately on the
 * canvas page.
 */
export function PersistenceSync() {
  useWorkspaceSync();
  useAgentSync();
  return null;
}
