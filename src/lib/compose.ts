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
}

/** Split one paragraph into plain-text and citation pieces.
 *  `citedOrder` tracks first-appearance order of paper ids across the whole
 *  document (existing + new) so numeric styles ([1], [2]…) stay stable. */
export function parseSectionParagraph(
  paragraph: string,
  papers: PaperSource[],
  style: CitationStyle,
  citedOrder: string[],
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
    });
    last = start + match[0].length;
  }
  if (last < paragraph.length) pieces.push({ text: paragraph.slice(last) });
  return pieces.filter((p) => p.text.length > 0);
}

/** Convert a drafted section into TipTap nodes: an H2 heading + paragraphs
 *  whose [n] markers became citation marks. Mutates nothing; `citedSoFar` is
 *  copied. */
export function sectionToContent(
  title: string,
  prose: string,
  papers: PaperSource[],
  style: CitationStyle,
  citedSoFar: string[] = [],
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
    const pieces = parseSectionParagraph(p, papers, style, citedOrder);
    if (pieces.length === 0) continue;
    out.push({
      type: "paragraph",
      content: pieces.map((piece) =>
        piece.paperId
          ? {
              type: "text",
              text: piece.text,
              marks: [{ type: "citation", attrs: { paperId: piece.paperId } }],
            }
          : { type: "text", text: piece.text },
      ),
    });
  }
  return out;
}
