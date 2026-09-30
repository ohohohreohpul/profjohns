"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import { PricingCards } from "@/components/billing/pricing-cards";
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";

/**
 * Client-side content for the pricing page.
 * Must be wrapped in <Suspense> because it uses useSearchParams().
 */
export function PricingPageContent() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("status") === "cancelled";

  return (
    <div className="min-h-dvh bg-grey-50">
      <header className="border-b border-grey-200 bg-paper">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-0">
            <ProfJohnsLogo size={40} className="shrink-0 -mr-1" />
            <img
              src="/profjohns-text.svg"
              alt="ProfJohns"
              className="h-[20px] w-auto"
            />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] font-medium text-grey-600 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Simple, honest pricing
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-grey-500">
            Start free. Upgrade to Pro when you need unlimited projects and the
            full research agent. Cancel anytime.
          </p>
        </div>

        {cancelled && (
          <div className="mx-auto mb-8 flex max-w-md items-center gap-2.5 rounded-lg border border-grey-200 bg-paper px-4 py-3 text-[13px] text-grey-600 shadow-sm">
            <WarningCircle className="size-4 shrink-0 text-grey-400" />
            Checkout was cancelled. You can try again anytime.
          </div>
        )}

        <PricingCards />

        <div className="mt-12 text-center">
          <p className="text-[12.5px] text-grey-400">
            Prices in USD. Billed monthly through Stripe. Secure payment
            processing — we never see your card details.
          </p>
          <p className="mt-3 text-[12px] text-grey-400">
            <Link href="/terms" className="hover:text-grey-600">Terms</Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="hover:text-grey-600">Privacy</Link>
          </p>
        </div>
      </main>
    </div>
  );
}