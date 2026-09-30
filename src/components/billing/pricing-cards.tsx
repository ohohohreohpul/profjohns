"use client";

import * as React from "react";
import { Check, ArrowRight, Sparkle } from "@phosphor-icons/react";
import { PLAN_LIST, type Plan } from "@/lib/stripe/plans";
import { useSubscription } from "@/lib/stripe/use-subscription";
import { useAuth } from "@/lib/auth/auth-context";
import Link from "next/link";

type CheckoutState = "idle" | "loading" | "error";

/**
 * Pricing cards — the two-plan comparison grid used on the public pricing
 * page. Handles the Stripe Checkout redirect for authenticated users, and
 * prompts sign-in for visitors who aren't logged in yet.
 */
export function PricingCards() {
  const { planId, loading: subLoading } = useSubscription();
  const { enabled, user } = useAuth();
  const [checkoutState, setCheckoutState] = React.useState<CheckoutState>("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleSubscribe(plan: Plan) {
    if (plan.id === "free") return;
    if (!enabled || !user) {
      window.location.href = "/signup?redirect=/pricing";
      return;
    }

    setCheckoutState("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start checkout.");
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      setCheckoutState("error");
      setErrorMsg(
        error instanceof Error ? error.message : "Checkout failed. Please try again.",
      );
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      {PLAN_LIST.map((plan) => {
        const isCurrent = !subLoading && planId === plan.id;
        const isPro = plan.id === "pro";
        const isCheckoutLoading =
          checkoutState === "loading" && isPro;

        return (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-6 transition-shadow ${
              isPro
                ? "border-ink/15 bg-paper shadow-[0_2px_24px_-8px_rgba(0,0,0,0.08)]"
                : "border-grey-200 bg-paper shadow-sm"
            }`}
          >
            {isPro && (
              <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-paper">
                <Sparkle className="size-3" />
                Recommended
              </span>
            )}

            <div className="mb-5">
              <h3 className="font-display text-xl font-semibold text-ink">
                {plan.name}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-grey-500">
                {plan.description}
              </p>
            </div>

            <div className="mb-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-ink">
                ${plan.priceMonthly}
              </span>
              <span className="text-[13px] text-grey-500">
                {plan.priceMonthly > 0 ? "/mo" : "forever"}
              </span>
            </div>

            <ul className="mb-6 flex flex-1 flex-col gap-2.5">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-[13.5px] text-grey-700"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-ink"
                    weight="bold"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              {isCurrent ? (
                <div
                  className="flex items-center justify-center gap-2 rounded-lg border border-grey-200 bg-grey-50 px-4 py-2.5 text-[13.5px] font-medium text-grey-600"
                >
                  <Check className="size-4" />
                  Current plan
                </div>
              ) : plan.id === "free" ? (
                <Link
                  href={enabled ? "/" : "/signup"}
                  className="flex items-center justify-center gap-2 rounded-lg border border-grey-200 bg-paper px-4 py-2.5 text-[13.5px] font-medium text-grey-700 transition-colors hover:bg-grey-50"
                >
                  Get started
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCheckoutLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-grey-800 disabled:opacity-50"
                >
                  {isCheckoutLoading ? "Redirecting…" : "Subscribe to Pro"}
                  {!isCheckoutLoading && <ArrowRight className="size-4" />}
                </button>
              )}

              {isPro && checkoutState === "error" && errorMsg && (
                <p className="mt-2 text-[12px] text-feedback-danger">{errorMsg}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}