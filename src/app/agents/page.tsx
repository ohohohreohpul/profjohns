"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { AgentsSurface } from "@/components/workspace/surfaces/agents-surface";
import { PageLoader } from "@/components/brand/page-loader";

export default function AgentsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="agents">
        <AgentsSurface />
      </WorkspaceShell>
    </Suspense>
  );
}
