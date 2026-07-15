"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { DiscoverHome } from "@/components/home/discover-home";
import { PageLoader } from "@/components/brand/page-loader";

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="discover">
        <DiscoverHome />
      </WorkspaceShell>
    </Suspense>
  );
}
