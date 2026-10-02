import type { JSONContent } from "@tiptap/core";
import type { WritingDoc } from "./document";
import { FIGURE_MENTION_NODE, FIGURE_NODE, captionBody, figureNumbers, mentionLabel, type VisualData, type VisualKind } from "./draft-figures";

/** A figure's picture, ready to embed (prepared by the export menu). */
export interface EmbeddedImage {
  readonly data: Uint8Array;
  readonly type: "png" | "jpg";
  /** Display size in the document, px at 96 dpi. */
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

/** Supported export formats for a writing document. */
export type ExportFormat = "markdown" | "latex" | "text" | "docx";

/** Flatten a block node's inline children to plain text ("Figure N" for references). */
function inlineText(node: JSONContent, numbers: ReadonlyMap<string, number>): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === FIGURE_MENTION_NODE) return mentionLabel(String(node.attrs?.cardId ?? ""), numbers);
  return (node.content ?? []).map((c) => inlineText(c, numbers)).join("");
}

interface FlatBlock {
  type: "heading" | "paragraph" | "listItem" | "blockquote" | "figure" | "other";
  text: string;
  ordered?: boolean;
  /** Figure blocks: "Figure N." (the text holds the caption body). */
  label?: string;
  number?: number;
}

/** Walk the document into a flat list of blocks for serialization. */
function flattenBlocks(content: JSONContent | undefined): FlatBlock[] {
  const out: FlatBlock[] = [];
  const numbers = figureNumbers(content);
  const inline = (n: JSONContent) => inlineText(n, numbers);
  let figures = 0;
  const walk = (node: JSONContent, listKind?: "bullet" | "ordered") => {
    switch (node.type) {
      case FIGURE_NODE: {
        const { kind, data } = (node.attrs ?? {}) as { kind: VisualKind; data: VisualData };
        figures++;
        out.push({ type: "figure", number: figures, label: `Figure ${figures}.`, text: data ? captionBody(kind, data) : "" });
        return;
      }
      case "heading":
        out.push({ type: "heading", text: inline(node) });
        return;
      case "paragraph": {
        const text = inline(node);
        if (text.trim()) out.push({ type: "paragraph", text });
        return;
      }
      case "blockquote":
        out.push({ type: "blockquote", text: inline(node) });
        return;
      case "listItem":
        out.push({
          type: "listItem",
          text: inline(node),
          ordered: listKind === "ordered",
        });
        return;
      case "bulletList":
        (node.content ?? []).forEach((c) => walk(c, "bullet"));
        return;
      case "orderedList":
        (node.content ?? []).forEach((c) => walk(c, "ordered"));
        return;
      default:
        (node.content ?? []).forEach((c) => walk(c, listKind));
    }
  };
  if (content) (content.content ?? []).forEach((c) => walk(c));
  return out;
}

export const EXPORT_LABEL: Record<ExportFormat, string> = {
  markdown: "Markdown (.md)",
  latex: "LaTeX (.tex)",
  text: "Plain text (.txt)",
  docx: "Word (.docx)",
};

const EXTENSION: Record<ExportFormat, string> = {
  markdown: "md",
  latex: "tex",
  text: "txt",
  docx: "docx",
};

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document"
  );
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

export function docToMarkdown(doc: WritingDoc, references: string[] = []): string {
  const body = flattenBlocks(doc.content)
    .map((b) =>
      b.type === "heading"
        ? `## ${b.text}`
        : b.type === "figure"
          ? `**${b.label}** ${b.text}`.trim()
          : b.type === "listItem"
          ? `${b.ordered ? "1." : "-"} ${b.text}`
          : b.type === "blockquote"
            ? `> ${b.text}`
            : b.text,
    )
    .join("\n\n");
  const refs = references.length
    ? `\n\n## References\n\n${references.map((r) => `- ${r}`).join("\n")}`
    : "";
  return `# ${doc.title}\n\n${body}${refs}\n`;
}

export function docToPlainText(doc: WritingDoc, references: string[] = []): string {
  const body = flattenBlocks(doc.content)
    .map((b) => (b.type === "figure" ? `${b.label} ${b.text}`.trim() : b.text))
    .join("\n\n");
  const refs = references.length
    ? `\n\nReferences\n\n${references.join("\n")}`
    : "";
  return `${doc.title}\n\n${body}${refs}\n`;
}

export function docToLatex(doc: WritingDoc, references: string[] = []): string {
  const body = flattenBlocks(doc.content)
    .map((b) =>
      b.type === "heading"
        ? `\\section*{${escapeLatex(b.text)}}`
        : b.type === "figure"
          ? `\\paragraph*{${b.label}} ${escapeLatex(b.text)}`
          : escapeLatex(b.text),
    )
    .join("\n\n");
  const refs = references.length
    ? [
        "\\section*{References}",
        "\\begin{enumerate}",
        ...references.map((r) => `\\item ${escapeLatex(r)}`),
        "\\end{enumerate}",
      ].join("\n")
    : "";
  return [
    "\\documentclass{article}",
    "\\usepackage[utf8]{inputenc}",
    `\\title{${escapeLatex(doc.title)}}`,
    "\\begin{document}",
    "\\maketitle",
    body,
    refs,
    "\\end{document}",
    "",
  ].join("\n");
}

/** Build a real .docx Blob. The `docx` library is imported lazily. */
async function docToDocxBlob(
  doc: WritingDoc,
  references: string[],
  images: ReadonlyMap<number, EmbeddedImage>,
): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun, AlignmentType } = await import("docx");
  const figure = (b: FlatBlock) => {
    const image = b.number !== undefined ? images.get(b.number) : undefined;
    const caption = new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: `${b.label} `, bold: true }), new TextRun(b.text)],
    });
    if (!image) return [caption];
    const picture = new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true, // never strand a figure on one page and its caption on the next
      children: [
        new ImageRun({
          type: image.type,
          data: image.data,
          transformation: { width: image.width, height: image.height },
          altText: { name: b.label ?? "Figure", title: b.label ?? "Figure", description: image.alt },
        }),
      ],
    });
    return [picture, caption];
  };
  const children = [
    new Paragraph({ text: doc.title, heading: HeadingLevel.TITLE }),
    ...flattenBlocks(doc.content).flatMap((b) =>
      b.type === "heading"
        ? [new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_1 })]
        : b.type === "figure"
          ? figure(b)
          : [new Paragraph({ children: [new TextRun(b.text)] })],
    ),
  ];
  if (references.length) {
    children.push(
      new Paragraph({ text: "References", heading: HeadingLevel.HEADING_1 }),
      ...references.map((r) => new Paragraph({ children: [new TextRun(r)] })),
    );
  }
  const docx = new Document({ sections: [{ children }] });
  return Packer.toBlob(docx);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Export a document in the chosen format and trigger a browser download. */
export async function exportDocument(
  doc: WritingDoc,
  format: ExportFormat,
  references: string[] = [],
  /** Figure pictures by figure number (Word only; other formats get captions). */
  images: ReadonlyMap<number, EmbeddedImage> = new Map(),
): Promise<void> {
  const filename = `${slugify(doc.title)}.${EXTENSION[format]}`;

  if (format === "docx") {
    const blob = await docToDocxBlob(doc, references, images);
    triggerDownload(blob, filename);
    return;
  }

  const text =
    format === "markdown"
      ? docToMarkdown(doc, references)
      : format === "latex"
        ? docToLatex(doc, references)
        : docToPlainText(doc, references);

  triggerDownload(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
}
