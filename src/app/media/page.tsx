"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { MediaSurface } from "@/components/workspace/surfaces/media-surface";
import { PageLoader } from "@/components/brand/page-loader";

export default function MediaPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="media">
        <MediaSurface />
      </WorkspaceShell>
    </Suspense>
  );
}
