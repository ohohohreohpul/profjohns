"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { LinksSurface } from "@/components/workspace/surfaces/links-surface";
import { PageLoader } from "@/components/brand/page-loader";

export default function LinksPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="links">
        <LinksSurface />
      </WorkspaceShell>
    </Suspense>
  );
}
