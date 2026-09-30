"use client";

import * as React from "react";
import type { Plan, PlanId } from "@/lib/stripe/plans";
import { PLANS } from "@/lib/stripe/plans";
import type { SubscriptionStatus } from "@/lib/stripe/subscription";

export interface SubscriptionState {
  plan: Plan;
  planId: PlanId;
  status: SubscriptionStatus;
  loading: boolean;
  /** Refresh the subscription from the server. */
  refresh: () => Promise<void>;
}

/**
 * Client-side hook that fetches the current user's subscription status
 * from the billing API. Returns the effective plan (with grace-period
 * logic applied server-side).
 */
export function useSubscription(): SubscriptionState {
  const [planId, setPlanId] = React.useState<PlanId>("free");
  const [status, setStatus] = React.useState<SubscriptionStatus>("none");
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/billing/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPlanId(data.plan ?? "free");
      setStatus(data.status ?? "none");
    } catch {
      // Network errors default to free — billing is non-critical on the client.
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    plan: PLANS[planId],
    planId,
    status,
    loading,
    refresh,
  };
}