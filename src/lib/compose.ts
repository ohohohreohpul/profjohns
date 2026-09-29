/**
 * Compose — canvas → paper (VISION Phase 6).
 *
 * Pure helpers that turn an AI-drafted section (prose with numeric [n]
 * citation markers) into TipTap content whose citations are REAL citation
 * marks tied to paper ids — so every drafted sentence stays traceable to a
 * source on the board. Invalid markers (an [n] with no matching source) are
 * left as visible plain text, never silently converted: a fabricated citation
 * must be seen, not laundered.
 *
 * Dependency-light (types + citation formatting only) and unit-tested.
 */
import type { JSONContent } from "@tiptap/core";
import type { PaperSource } from "@/lib/mock";
import { formatInText, type CitationStyle } from "@/lib/citation";

const MARKER = /\[(\d{1,2})\]/g;

interface TextPiece {
  text: string;
  paperId?: string;
  display?: string;
  /** True when this citation's source was judged unsupported (E0.3). */
  unsupported?: boolean;
}

/** Split one paragraph into plain-text and citation pieces.
 *  `citedOrder` tracks first-appearance order of paper ids across the whole
 *  document (existing + new) so numeric styles ([1], [2]…) stay stable.
 *  `unsupportedIds` (E0.3) flags citation marks whose source was judged
 *  unsupported — those pieces are marked so the editor renders them visibly
 *  flagged instead of as clean citations. */
export function parseSectionParagraph(
  paragraph: string,
  papers: PaperSource[],
  style: CitationStyle,
  citedOrder: string[],
  unsupportedIds?: ReadonlySet<string>,
): TextPiece[] {
  const pieces: TextPiece[] = [];
  let last = 0;
  for (const match of paragraph.matchAll(MARKER)) {
    const n = Number(match[1]);
    const paper = n >= 1 ? papers[n - 1] : undefined;
    const start = match.index ?? 0;
    if (!paper) continue; // leave the literal [n] in the surrounding text
    if (start > last) pieces.push({ text: paragraph.slice(last, start) });
    if (!citedOrder.includes(paper.id)) citedOrder.push(paper.id);
    const index = citedOrder.indexOf(paper.id) + 1;
    pieces.push({
      text: formatInText(paper, style, index),
      paperId: paper.id,
      display: formatInText(paper, style, index),
      unsupported: unsupportedIds?.has(paper.id) ?? false,
    });
    last = start + match[0].length;
  }
  if (last < paragraph.length) pieces.push({ text: paragraph.slice(last) });
  return pieces.filter((p) => p.text.length > 0);
}

/** Convert a drafted section into TipTap nodes: an H2 heading + paragraphs
 *  whose [n] markers became citation marks. Mutates nothing; `citedSoFar` is
 *  copied. `unsupportedIds` (E0.3) adds a visible `unsupported` mark to
 *  citation pieces whose source was judged unsupported, so a fabricated or
 *  weak citation is seen, never laundered as a clean citation. */
export function sectionToContent(
  title: string,
  prose: string,
  papers: PaperSource[],
  style: CitationStyle,
  citedSoFar: string[] = [],
  unsupportedIds?: ReadonlySet<string>,
): JSONContent[] {
  const citedOrder = [...citedSoFar];
  const out: JSONContent[] = [];
  const cleanTitle = title.trim();
  if (cleanTitle) {
    out.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: cleanTitle }],
    });
  }
  const paragraphs = prose
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const p of paragraphs) {
    const pieces = parseSectionParagraph(p, papers, style, citedOrder, unsupportedIds);
    if (pieces.length === 0) continue;
    out.push({
      type: "paragraph",
      content: pieces.map((piece) => {
        if (!piece.paperId) return { type: "text", text: piece.text };
        const marks: NonNullable<JSONContent["marks"]> = [
          { type: "citation", attrs: { paperId: piece.paperId } },
        ];
        if (piece.unsupported) {
          marks.push({ type: "unsupported", attrs: { paperId: piece.paperId } });
        }
        return { type: "text", text: piece.text, marks };
      }),
    });
  }
  return out;
}
