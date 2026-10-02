/**
 * Figures in the Draft. A figure node carries a copy of its board card's
 * data (image or chart), so the document stands on its own: it renders and
 * exports even without the board, and survives the card being deleted.
 * Numbers come from document order, so moving a figure renumbers it.
 */
import type { JSONContent } from "@tiptap/core";
import type { CardDataFor } from "@/lib/board/schema";
import { shortCitation } from "@/lib/insight";

export const FIGURE_NODE = "figureRef";
/** Inline "Figure N" reference in the text, pointing at a figure's card. */
export const FIGURE_MENTION_NODE = "figureMention";

export type VisualKind = "figure" | "chart";
export type VisualData = CardDataFor["figure"] | CardDataFor["chart"];

/** A figure or chart card, as the Draft needs it. */
export interface BoardVisual {
  readonly id: string;
  readonly kind: VisualKind;
  readonly data: VisualData;
}

export interface DraftFigure {
  readonly cardId: string;
  readonly kind: VisualKind;
  readonly data: VisualData;
  /** 1-based, in document order. */
  readonly number: number;
}

export function figureNodeFor(visual: BoardVisual): JSONContent {
  return { type: FIGURE_NODE, attrs: { cardId: visual.id, kind: visual.kind, data: visual.data } };
}

/** Every figure in the document, numbered in reading order. */
export function listFigures(content: JSONContent | undefined): DraftFigure[] {
  const out: DraftFigure[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === FIGURE_NODE && node.attrs) {
      const { cardId, kind, data } = node.attrs as { cardId: string; kind: VisualKind; data: VisualData };
      out.push({ cardId, kind, data, number: out.length + 1 });
      return;
    }
    (node.content ?? []).forEach(walk);
  };
  if (content) walk(content);
  return out;
}

const sentence = (s: string) => {
  const t = s.trim();
  return t && !/[.!?]$/.test(t) ? `${t}.` : t;
};

/** The caption text without the "Figure N." label (shown under the figure). */
export function captionBody(kind: VisualKind, data: VisualData): string {
  const title = kind === "chart" ? (data as CardDataFor["chart"]).title : "";
  const source = data.source
    ? `Source: ${shortCitation({ authors: data.source.authors ?? "", year: data.source.year ?? 0, title: data.source.title }, data.page)}`
    : "";
  return [title, data.caption, source].map(sentence).filter(Boolean).join(" ");
}

/** "Figure 2. Title. Caption. Source: Author et al. (2021), p. 4." */
export function figureCaption(kind: VisualKind, data: VisualData, number: number): string {
  const body = captionBody(kind, data);
  return body ? `Figure ${number}. ${body}` : `Figure ${number}.`;
}

const isEmptyParagraph = (n: JSONContent | undefined) => n?.type === "paragraph" && !(n.content ?? []).length;

/** A new document with `figure` added at the end (and room to keep writing). */
export function appendFigure(content: JSONContent, figure: JSONContent): JSONContent {
  const blocks = content.content ?? [];
  const kept = blocks.length === 1 && isEmptyParagraph(blocks[0]) ? [] : blocks;
  return { ...content, content: [...kept, figure, { type: "paragraph" }] };
}

/** Each placed figure's current number, by card id (its first appearance). */
export function figureNumbers(content: JSONContent | undefined): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const f of listFigures(content)) if (!numbers.has(f.cardId)) numbers.set(f.cardId, f.number);
  return numbers;
}

/** What a reference reads as: "Figure 2", or "Figure ?" once its figure is gone. */
export function mentionLabel(cardId: string, numbers: ReadonlyMap<string, number>): string {
  const n = numbers.get(cardId);
  return n ? `Figure ${n}` : "Figure ?";
}

export function figureMentionFor(cardId: string): JSONContent {
  return { type: FIGURE_MENTION_NODE, attrs: { cardId } };
}

/**
 * A copy of `content` with figure and reference card ids swapped through
 * `map` (unknown ids stay, so a reference to a missing figure still shows
 * as missing). Used when a board's cards become canvas nodes.
 */
export function remapCardIds(content: JSONContent, map: ReadonlyMap<string, string>): JSONContent {
  const walk = (node: JSONContent): JSONContent => {
    const isRef = node.type === FIGURE_NODE || node.type === FIGURE_MENTION_NODE;
    const cardId = isRef ? (node.attrs?.cardId as string | undefined) : undefined;
    const attrs = cardId && map.has(cardId) ? { ...node.attrs, cardId: map.get(cardId) } : node.attrs;
    return { ...node, ...(attrs ? { attrs } : {}), ...(node.content ? { content: node.content.map(walk) } : {}) };
  };
  return walk(content);
}
