"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WatchSurface } from "@/components/workspace/surfaces/watch-surface";
import { PageLoader } from "@/components/brand/page-loader";

export default function WatchPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="watch">
        <WatchSurface />
      </WorkspaceShell>
    </Suspense>
  );
}
