/**
 * Card-backed canvas nodes (Insight, Theme, Figure, Chart). Each keeps the
 * board card's payload in `data.card`, validated by the same schema, so the
 * card designs and helpers are shared. Relations come from canvas edges:
 * an insight wired into a theme belongs to it; themes and insights wired
 * into a Draft are what it writes from.
 */
import { parseCardData, type Card, type CardDataFor } from "@/lib/board/schema";
import { buildClaims } from "@/lib/board/claims";
import type { BoardVisual } from "@/lib/draft-figures";

export const CARD_NODE_KINDS = ["insight", "theme", "figure", "chart"] as const;
export type CardNodeKind = (typeof CARD_NODE_KINDS)[number];

interface NodeLike {
  readonly id: string;
  readonly data: { readonly kind?: unknown; readonly card?: unknown };
}
interface EdgeLike {
  readonly source: string;
  readonly target: string;
}

/** The node's card payload if it is a valid card of `kind`, else null. */
export function cardOf<K extends CardNodeKind>(node: NodeLike, kind: K): CardDataFor[K] | null {
  if (node.data.kind !== kind || node.data.card === undefined) return null;
  try {
    return parseCardData(kind, node.data.card) as CardDataFor[K];
  } catch {
    return null;
  }
}

/** A canvas node viewed as a board card (for the shared card components). */
function asCard<K extends CardNodeKind>(id: string, kind: K, data: CardDataFor[K]): Card<K> {
  return { id, boardId: "", wallId: null, kind, position: 0, data, updatedAt: "" } as Card<K>;
}

const sourcesOf = (edges: readonly EdgeLike[], target: string) =>
  new Set(edges.filter((e) => e.target === target).map((e) => e.source));

/** The insight nodes connected into theme `themeId`, as insight cards. */
export function themeInsights(nodes: readonly NodeLike[], edges: readonly EdgeLike[], themeId: string): Card<"insight">[] {
  const into = sourcesOf(edges, themeId);
  return nodes.flatMap((n) => {
    const data = into.has(n.id) ? cardOf(n, "insight") : null;
    return data ? [asCard(n.id, "insight", data)] : [];
  });
}

/**
 * What a Draft writes from: themes wired into it (with their insights) and
 * insights wired in directly, each line carrying its citation.
 */
export function canvasClaims(nodes: readonly NodeLike[], edges: readonly EdgeLike[], draftId: string): string {
  const into = sourcesOf(edges, draftId);
  const themes = nodes.flatMap((n) => {
    const data = into.has(n.id) ? cardOf(n, "theme") : null;
    return data ? [asCard(n.id, "theme", data)] : [];
  });
  const themed = themes.flatMap((t) =>
    themeInsights(nodes, edges, t.id).map((i) => ({ ...i, data: { ...i.data, themeId: t.id } })),
  );
  const seen = new Set(themed.map((i) => i.id));
  const loose = nodes.flatMap((n) => {
    const data = into.has(n.id) && !seen.has(n.id) ? cardOf(n, "insight") : null;
    return data ? [asCard(n.id, "insight", { ...data, themeId: undefined })] : [];
  });
  return buildClaims([...themed, ...loose], themes);
}

/** Every valid figure and chart on the canvas, for placing in a Draft. */
export function canvasVisuals(nodes: readonly NodeLike[]): BoardVisual[] {
  return nodes.flatMap((n): BoardVisual[] => {
    if (n.data.kind === "figure") {
      const data = cardOf(n, "figure");
      return data ? [{ id: n.id, kind: "figure", data }] : [];
    }
    if (n.data.kind === "chart") {
      const data = cardOf(n, "chart");
      return data ? [{ id: n.id, kind: "chart", data }] : [];
    }
    return [];
  });
}
