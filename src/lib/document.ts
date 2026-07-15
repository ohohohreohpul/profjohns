/**
 * Document model for the Writing surface. Backed by ProseMirror/TipTap JSON
 * (`content`), so the editor owns the structure and citations are first-class
 * inline marks rather than a separate, drift-prone id list.
 */

import type { JSONContent } from "@tiptap/core";
import { DEFAULT_STYLE, type CitationStyle } from "./citation";

export interface WritingDoc {
  title: string;
  /** ProseMirror document JSON. Single source of truth for body + citations. */
  content: JSONContent;
  /** Citation style the references are formatted in. */
  style: CitationStyle;
  /** Section headings for the document outline. */
  outline: string[];
}

/** An empty ProseMirror document (one empty paragraph). */
export function emptyDocContent(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function makeDefaultDoc(_direction: string): WritingDoc {
  return {
    title: "",
    content: emptyDocContent(),
    style: DEFAULT_STYLE,
    outline: [],
  };
}

/** Legacy block shape — only used to migrate old persisted documents. */
interface LegacyBlock {
  type?: "heading" | "paragraph";
  text?: string;
  html?: string;
}

/**
 * Convert the old block array to ProseMirror JSON. Text and heading structure
 * survive; the old inline HTML is dropped (it was rarely populated and never a
 * structured model). Runs once per doc on rehydrate.
 */
export function migrateBlocksToContent(blocks: LegacyBlock[]): JSONContent {
  const nodes = (blocks ?? []).map((b) => {
    const text = (b.text ?? "").trim();
    const inline = text ? [{ type: "text", text }] : [];
    return b.type === "heading"
      ? { type: "heading", attrs: { level: 2 }, content: inline }
      : { type: "paragraph", content: inline };
  });
  return { type: "doc", content: nodes.length ? nodes : [{ type: "paragraph" }] };
}

const BLOCK_NODES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "codeBlock",
]);

/** Plain text of a document — for word counts, snippets, and search. */
export function extractText(content: JSONContent | undefined): string {
  if (!content) return "";
  const parts: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "text" && node.text) parts.push(node.text);
    (node.content ?? []).forEach(walk);
    if (node.type && BLOCK_NODES.has(node.type)) parts.push("\n\n");
  };
  walk(content);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/** Paper ids cited in the document, in first-seen order — derived from the
 *  citation marks so it can never drift from the actual text. */
export function extractCitedPaperIds(content: JSONContent | undefined): string[] {
  const ids: string[] = [];
  const walk = (node: JSONContent) => {
    for (const mark of node.marks ?? []) {
      const id = mark.type === "citation" ? mark.attrs?.paperId : undefined;
      if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
    }
    (node.content ?? []).forEach(walk);
  };
  if (content) walk(content);
  return ids;
}

/** Build ProseMirror paragraph nodes from AI prose (blank-line separated). */
export function paragraphsToContent(prose: string): JSONContent[] {
  return prose
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] }));
}
