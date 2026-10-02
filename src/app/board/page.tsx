"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * The board is retired: the canvas is the one workspace, and a board's cards
 * are brought onto its canvas the first time it opens. Old links land there.
 */
function BoardRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  React.useEffect(() => {
    router.replace(`/canvas?${params.toString()}`);
  }, [router, params]);
  return (
    <main className="flex h-dvh items-center justify-center bg-canvas p-6">
      <p role="status" className="text-sm text-grey-600">
        Opening your canvas…
      </p>
    </main>
  );
}

export default function Page() {
  return (
    <React.Suspense fallback={null}>
      <BoardRedirect />
    </React.Suspense>
  );
}
