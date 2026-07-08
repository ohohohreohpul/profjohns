"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { AccountSurface } from "@/components/workspace/surfaces/account-surface";
import { PageLoader } from "@/components/brand/page-loader";

export default function AccountPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="account">
        <AccountSurface />
      </WorkspaceShell>
    </Suspense>
  );
}
