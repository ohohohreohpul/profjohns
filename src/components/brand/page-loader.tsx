"use client";

import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";

/** Lightweight branded loading state for Suspense fallbacks and route transitions. */
export function PageLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-grey-50">
      <div className="flex flex-col items-center gap-5">
        <ProfJohnsLogo size={144} className="animate-wordmark" />
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-grey-300" style={{ animation: "wordmark-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite", animationDelay: "0ms" }} />
          <span className="size-2.5 rounded-full bg-grey-300" style={{ animation: "wordmark-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite", animationDelay: "200ms" }} />
          <span className="size-2.5 rounded-full bg-grey-300" style={{ animation: "wordmark-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite", animationDelay: "400ms" }} />
        </div>
      </div>
    </div>
  );
}
