/**
 * Block-based document model for the Writing surface. A document is a title
 * plus an ordered list of editable blocks. Kept deliberately small — enough
 * structure for a literature review without pulling in a full editor engine.
 */

import { DEFAULT_STYLE, type CitationStyle } from "./citation";

export type BlockType = "heading" | "paragraph";

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  /** Rich HTML (bold/italic/links). Falls back to `text` when absent. */
  html?: string;
}

/** Minimal sanitizer for editor HTML — strips scripts, styles, and handlers. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\/?(?:script|style)[^>]*>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export interface WritingDoc {
  title: string;
  blocks: Block[];
  /** Citation style the references are formatted in. */
  style: CitationStyle;
  /** Paper ids cited in this document, in citation order. */
  citationIds: string[];
  /** Section headings for the document outline. */
  outline: string[];
}

let blockSeq = 0;

export function nextBlockId(): string {
  blockSeq += 1;
  return `b${blockSeq}`;
}

export function makeBlock(type: BlockType, text = ""): Block {
  return { id: nextBlockId(), type, text };
}

export function makeDefaultDoc(_direction: string): WritingDoc {
  return {
    title: "",
    style: DEFAULT_STYLE,
    citationIds: [],
    outline: [],
    blocks: [makeBlock("paragraph", "")],
  };
}
