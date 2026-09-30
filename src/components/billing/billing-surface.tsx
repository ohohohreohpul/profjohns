"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  ArrowRight,
  ArrowClockwise,
  CreditCard,
  WarningCircle,
} from "@phosphor-icons/react";
import { SurfaceScaffold } from "@/components/workspace/workspace-shell";
import { useSubscription } from "@/lib/stripe/use-subscription";
import { useAuth } from "@/lib/auth/auth-context";
import { PLANS } from "@/lib/stripe/plans";
import type { SubscriptionStatus } from "@/lib/stripe/subscription";

const STATUS_LABELS: Partial<Record<SubscriptionStatus, string>> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due — payment retry in progress",
  canceled: "Canceled",
  incomplete: "Incomplete",
  none: "No subscription",
};

const STATUS_COLORS: Partial<Record<SubscriptionStatus, string>> = {
  active: "text-feedback-success",
  trialing: "text-feedback-success",
  past_due: "text-feedback-warning",
  canceled: "text-grey-500",
  incomplete: "text-feedback-danger",
  none: "text-grey-500",
};

type PortalState = "idle" | "loading" | "error";

/** Billing surface — current plan, status, and management actions. */
export function BillingSurface() {
  const { plan, planId, status, loading, refresh } = useSubscription();
  const { enabled, user } = useAuth();
  const [portalState, setPortalState] = React.useState<PortalState>("idle");
  const [portalError, setPortalError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Show success banner when arriving from a successful checkout.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      setSuccessMsg("Your Pro subscription is active. Welcome aboard.");
      // Clean the URL without a navigation event.
      window.history.replaceState({}, "", "/billing");
      void refresh();
    }
  }, [refresh]);

  async function handlePortal() {
    setPortalState("loading");
    setPortalError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to open billing portal.");
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      setPortalState("error");
      setPortalError(
        error instanceof Error ? error.message : "Failed to open portal.",
      );
    }
  }

  if (!enabled || !user) {
    return (
      <SurfaceScaffold title="Billing" description="Manage your subscription.">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-grey-200 bg-paper p-6 text-center shadow-sm">
            <p className="text-[14px] font-medium text-ink">
              {enabled ? "You're signed out" : "Running in local mode"}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-grey-500">
              {enabled
                ? "Sign in to view and manage your subscription."
                : "Billing requires an account. Your work is saved locally in this browser only."}
            </p>
            {enabled && (
              <Link
                href="/login"
                className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-grey-800"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </SurfaceScaffold>
    );
  }

  const isPro = planId === "pro";
  const statusLabel = STATUS_LABELS[status] ?? "No subscription";
  const statusColor = STATUS_COLORS[status] ?? "text-grey-500";

  return (
    <SurfaceScaffold title="Billing" description="Manage your subscription and payment method.">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {successMsg && (
          <div className="flex items-center gap-2.5 rounded-lg border border-feedback-success-border bg-feedback-success-bg px-4 py-3 text-[13px] font-medium text-feedback-success">
            <Check className="size-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Current plan card */}
        <section className="rounded-xl border border-grey-200 bg-paper p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
                Current plan
              </h2>
              <p className="mt-0.5 text-[12.5px] text-grey-500">
                Your subscription status and details.
              </p>
            </div>
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="grid size-8 place-items-center rounded-md text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
              aria-label="Refresh billing status"
              title="Refresh"
            >
              <ArrowClockwise className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="rounded-lg bg-grey-100 px-3 py-1.5 text-[14px] font-semibold text-ink">
              {loading ? "Loading…" : plan.name}
            </span>
            <span className={`text-[12.5px] font-medium ${statusColor}`}>
              {statusLabel}
            </span>
          </div>

          {!loading && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-grey-500">
              {isPro
                ? `You're on the Pro plan at $${PLANS.pro.priceMonthly}/mo. Manage your subscription, update your card, or cancel through the Stripe portal.`
                : "You're on the Free plan. Upgrade to Pro for unlimited projects and the full research agent."}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            {isPro ? (
              <button
                onClick={handlePortal}
                disabled={portalState === "loading"}
                className="inline-flex items-center gap-2 rounded-lg border border-grey-200 bg-paper px-3.5 py-2 text-[13px] font-medium text-grey-700 transition-colors hover:bg-grey-50 disabled:opacity-50"
              >
                <CreditCard className="size-4" />
                {portalState === "loading" ? "Opening…" : "Manage subscription"}
              </button>
            ) : (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-paper transition-colors hover:bg-grey-800"
              >
                Upgrade to Pro
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>

          {portalState === "error" && portalError && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-feedback-danger">
              <WarningCircle className="size-3.5 shrink-0" />
              {portalError}
            </p>
          )}
        </section>

        {/* Plan features summary */}
        <section className="rounded-xl border border-grey-200 bg-paper p-5 shadow-sm">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
            What&apos;s included
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {plan.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2.5 text-[13px] text-grey-700"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-ink" weight="bold" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Link to pricing page */}
        <div className="text-center">
          <Link
            href="/pricing"
            className="text-[12.5px] font-medium text-grey-500 transition-colors hover:text-ink"
          >
            Compare plans
          </Link>
        </div>
      </div>
    </SurfaceScaffold>
  );
}