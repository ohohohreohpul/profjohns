"use client";

import * as React from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-grey-50 px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mb-6 text-[13px] text-grey-500">
          An unexpected error occurred while loading this page.
        </p>

        {error.digest && (
          <p className="mb-4 rounded-lg bg-grey-100 px-3 py-2 text-[11px] font-mono text-grey-400">
            Reference: {error.digest}
          </p>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-grey-800"
          >
            Try again
          </button>
          <Link
            href="/canvas"
            className="rounded-xl border border-grey-200 bg-paper px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-grey-50"
          >
            Go to workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
