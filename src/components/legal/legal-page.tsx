"use client";

import Link from "next/link";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import { ArrowLeft } from "@phosphor-icons/react";

/**
 * Shared layout for legal pages (Terms, Privacy).
 * Renders the ProfJohns header, a title, and the provided content body.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-grey-50">
      <header className="border-b border-grey-200 bg-paper">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
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

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-2 text-[13px] text-grey-400">
          Last updated: {lastUpdated}
        </p>

        <div className="mt-8 max-w-none prose-legal">
          {children}
        </div>
      </main>
    </div>
  );
}