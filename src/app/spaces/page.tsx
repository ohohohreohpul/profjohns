"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { SpacesSurface } from "@/components/home/spaces-surface";
import { PageLoader } from "@/components/brand/page-loader";

export default function SpacesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="spaces">
        <SpacesSurface />
      </WorkspaceShell>
    </Suspense>
  );
}
