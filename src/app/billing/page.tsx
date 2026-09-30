"use client";

import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { BillingSurface } from "@/components/billing/billing-surface";
import { PageLoader } from "@/components/brand/page-loader";

export default function BillingPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceShell active="billing">
        <BillingSurface />
      </WorkspaceShell>
    </Suspense>
  );
}