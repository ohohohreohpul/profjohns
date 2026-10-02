"use client";

import * as React from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { cardOf, type CardNodeKind } from "@/lib/canvas-cards";
import { parseCardData, type CardDataFor } from "@/lib/board/schema";
import type { PaperSource } from "@/lib/mock";

/**
 * A card-backed node's validated payload, a saver that validates before
 * writing (a bad change is refused, never stored), and the paper it cites.
 */
export function useCardNode<K extends CardNodeKind>(id: string, kind: K, data: Record<string, unknown>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const openReader = useCanvasStore((s) => s.openReader);
  const card = React.useMemo(() => cardOf({ id, data }, kind), [id, data, kind]);
  const save = React.useCallback(
    (next: CardDataFor[K]): boolean => {
      try {
        updateNodeData(id, { card: parseCardData(kind, next) });
        return true;
      } catch {
        return false;
      }
    },
    [id, kind, updateNodeData],
  );
  const paper = data.paper as PaperSource | undefined;
  const openPaper = paper?.url ? () => openReader(paper) : undefined;
  return { card, save, paper, openPaper };
}
