"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useCanvasStore } from "@/store/canvas-store";
import { SupabaseBoardRepository } from "@/lib/board/supabase-repository";
import { importBoardOnce, type BoardImportResult } from "@/lib/board/import-to-canvas";

/**
 * Once this canvas has loaded (signed in), bring back anything made on the
 * retired board for it, once. Returns what moved, for a one-time notice.
 */
export function useBoardReturn(canvasId: string): { result: BoardImportResult | null; dismiss: () => void } {
  const { user, enabled } = useAuth();
  const ready = useCanvasStore((s) => s.boardCanvasId === canvasId && s.hasHydrated);
  const [result, setResult] = React.useState<BoardImportResult | null>(null);
  const tried = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!enabled || !user || !ready || !canvasId || tried.current === canvasId) return;
    tried.current = canvasId;
    const sb = createClient();
    if (!sb) return;
    importBoardOnce(new SupabaseBoardRepository(sb), canvasId)
      .then((r) => {
        if (r && r.moved > 0) setResult(r);
      })
      .catch((err: unknown) => {
        // Claim released: it retries on the next open.
        console.error("[canvas] couldn't bring this board's cards back", err);
      });
  }, [enabled, user, ready, canvasId]);

  return { result, dismiss: () => setResult(null) };
}
