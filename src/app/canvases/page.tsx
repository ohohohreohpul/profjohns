"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { CanvasesSurface } from "@/components/workspace/surfaces/canvases-surface";
import { PageLoader } from "@/components/brand/page-loader";

export default function CanvasesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="canvases">
        <CanvasesSurface />
      </WorkspaceShell>
    </Suspense>
  );
}
