import type { WritingDoc } from "./document";

/** Supported export formats for a writing document. */
export type ExportFormat = "markdown" | "latex" | "text" | "docx";

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
  const body = doc.blocks
    .map((b) => (b.type === "heading" ? `## ${b.text}` : b.text))
    .join("\n\n");
  const refs = references.length
    ? `\n\n## References\n\n${references.map((r) => `- ${r}`).join("\n")}`
    : "";
  return `# ${doc.title}\n\n${body}${refs}\n`;
}

export function docToPlainText(doc: WritingDoc, references: string[] = []): string {
  const body = doc.blocks.map((b) => b.text).join("\n\n");
  const refs = references.length
    ? `\n\nReferences\n\n${references.join("\n")}`
    : "";
  return `${doc.title}\n\n${body}${refs}\n`;
}

export function docToLatex(doc: WritingDoc, references: string[] = []): string {
  const body = doc.blocks
    .map((b) =>
      b.type === "heading"
        ? `\\section*{${escapeLatex(b.text)}}`
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
): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import(
    "docx"
  );
  const children = [
    new Paragraph({ text: doc.title, heading: HeadingLevel.TITLE }),
    ...doc.blocks.map((b) =>
      b.type === "heading"
        ? new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_1 })
        : new Paragraph({ children: [new TextRun(b.text)] }),
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
): Promise<void> {
  const filename = `${slugify(doc.title)}.${EXTENSION[format]}`;

  if (format === "docx") {
    const blob = await docToDocxBlob(doc, references);
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
