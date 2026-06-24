"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { LibrarySurface } from "@/components/workspace/surfaces/library-surface";
import { AccountLibrarySurface } from "@/components/workspace/surfaces/account-library-surface";
import { PageLoader } from "@/components/brand/page-loader";

function LibraryRouter() {
  const projectId = useSearchParams().get("project");
  // With a project in the URL this is the Space's Library tab — the sidebar
  // should highlight "Spaces" (you're inside a Space), not the global Readroom.
  // Without a project it's the account-wide Readroom reached from the sidebar.
  return projectId ? <LibrarySurface /> : <AccountLibrarySurface />;
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ProjectAwareShell>
        <LibraryRouter />
      </ProjectAwareShell>
    </Suspense>
  );
}

function ProjectAwareShell({ children }: { children: React.ReactNode }) {
  const projectId = useSearchParams().get("project");
  return (
    <WorkspaceShell active={projectId ? "spaces" : "library"}>
      {children}
    </WorkspaceShell>
  );
}
