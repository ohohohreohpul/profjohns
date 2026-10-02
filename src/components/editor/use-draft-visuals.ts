"use client";

import * as React from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { canvasVisuals } from "@/lib/canvas-cards";
import type { BoardVisual } from "@/lib/draft-figures";

/**
 * Figures and charts the Draft can place and keep in sync: the board's
 * cards when a board draft is open, else the canvas's Figure/Chart nodes
 * (possibly none, so a figure whose node was deleted is flagged).
 */
export function useDraftVisuals(): readonly BoardVisual[] {
  const board = useCanvasStore((s) => s.boardDraftContext?.visuals);
  const nodes = useCanvasStore((s) => s.nodes);
  return React.useMemo(() => {
    return board ?? canvasVisuals(nodes);
  }, [board, nodes]);
}
