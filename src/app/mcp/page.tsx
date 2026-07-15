"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { McpSurface } from "@/components/workspace/surfaces/mcp-surface";
import { PageLoader } from "@/components/brand/page-loader";

export default function McpPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="mcp">
        <McpSurface />
      </WorkspaceShell>
    </Suspense>
  );
}
