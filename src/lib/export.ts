import type { JSONContent } from "@tiptap/core";
import type { WritingDoc } from "./document";
import type { PaperSource } from "./mock";
import type { CitationStyle } from "./citation";

/** Supported export formats for a writing document. */
export type ExportFormat = "markdown" | "latex" | "text" | "docx" | "pdf" | "bibtex";

/** Flatten a block node's inline children to plain text. */
function inlineText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(inlineText).join("");
}

interface FlatBlock {
  type: "heading" | "paragraph" | "listItem" | "blockquote" | "other";
  text: string;
  ordered?: boolean;
  level?: number;
  /** Citation paper IDs found in this block's marks. */
  citationIds?: string[];
}

/** Extract citation paper IDs from marks on text nodes. */
function extractCitations(node: JSONContent): string[] {
  const ids: string[] = [];
  if (node.marks) {
    for (const mark of node.marks) {
      if (mark.type === "citation" && mark.attrs?.paperId) {
        ids.push(String(mark.attrs.paperId));
      }
    }
  }
  return ids;
}

/** Walk the document into a flat list of blocks for serialization. */
function flattenBlocks(content: JSONContent | undefined): FlatBlock[] {
  const out: FlatBlock[] = [];
  const walk = (node: JSONContent, listKind?: "bullet" | "ordered") => {
    switch (node.type) {
      case "heading":
        out.push({ type: "heading", text: inlineText(node), level: node.attrs?.level ?? 1, citationIds: extractCitations(node) });
        return;
      case "paragraph": {
        const text = inlineText(node);
        if (text.trim()) out.push({ type: "paragraph", text, citationIds: extractCitations(node) });
        return;
      }
      case "blockquote":
        out.push({ type: "blockquote", text: inlineText(node), citationIds: extractCitations(node) });
        return;
      case "listItem":
        out.push({ type: "listItem", text: inlineText(node), ordered: listKind === "ordered", citationIds: extractCitations(node) });
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
  latex: "LaTeX (.tex + .bib)",
  text: "Plain text (.txt)",
  docx: "Word (.docx)",
  pdf: "PDF (compiled)",
  bibtex: "BibTeX (.bib)",
};

const EXTENSION: Record<ExportFormat, string> = {
  markdown: "md",
  latex: "tex",
  text: "txt",
  docx: "docx",
  pdf: "pdf",
  bibtex: "bib",
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

/** Sanitize a string for use as a BibTeX citation key. */
function bibKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 20) || "ref";
}

export function docToMarkdown(doc: WritingDoc, references: string[] = []): string {
  const body = flattenBlocks(doc.content)
    .map((b) =>
      b.type === "heading"
        ? `${"#".repeat(b.level ?? 1)} ${b.text}`
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
    .map((b) => b.text)
    .join("\n\n");
  const refs = references.length
    ? `\n\nReferences\n\n${references.join("\n")}`
    : "";
  return `${doc.title}\n\n${body}${refs}\n`;
}

/** Generate a BibTeX bibliography from cited sources. */
export function docToBibTeX(sources: PaperSource[]): string {
  return sources
    .map((s) => {
      const key = bibKey(s.id);
      const authors = s.authors.replace(/,?\s+et\.?\s+al\.?/gi, " and others");
      const year = s.year || new Date().getFullYear();
      const venue = s.venue || "Unknown";
      const doi = s.doi ? `,\n  doi = {${s.doi}}` : "";
      const url = s.url ? `,\n  url = {${s.url}}` : "";
      return `@article{${key},\n  title = {${s.title}},\n  author = {${authors}},\n  year = {${year}},\n  journal = {${venue}}${doi}${url}\n}`;
    })
    .join("\n\n");
}

/** Generate production-quality LaTeX with \cite{} commands and natbib. */
export function docToLatex(
  doc: WritingDoc,
  sources: PaperSource[] = [],
  references: string[] = [],
): string {
  const blocks = flattenBlocks(doc.content);

  // Build citation key map
  const citeMap = new Map<string, string>();
  sources.forEach((s) => citeMap.set(s.id, bibKey(s.id)));

  const body = blocks
    .map((b) => {
      if (b.type === "heading") {
        const cmd = (b.level ?? 1) === 1 ? "\\section" : "\\subsection";
        return `${cmd}{${escapeLatex(b.text)}}`;
      }
      if (b.type === "listItem") {
        return b.ordered
          ? `\\begin{enumerate}\n  \\item ${escapeLatex(b.text)}\n\\end{enumerate}`
          : `\\begin{itemize}\n  \\item ${escapeLatex(b.text)}\n\\end{itemize}`;
      }
      if (b.type === "blockquote") {
        return `\\begin{quote}\n${escapeLatex(b.text)}\n\\end{quote}`;
      }
      // Replace citation paper IDs with \cite{key}
      let text = escapeLatex(b.text);
      if (b.citationIds && b.citationIds.length > 0) {
        const keys = b.citationIds.map((id) => citeMap.get(id) ?? "").filter(Boolean);
        if (keys.length > 0) {
          text = `${text} \\cite{${keys.join(", ")}}`;
        }
      }
      return text;
    })
    .join("\n\n");

  // BibTeX bibliography section
  const bibSection = sources.length > 0
    ? [
        "\\bibliographystyle{plainnat}",
        `\\bibliography{${slugify(doc.title)}}`,
      ].join("\n")
    : references.length > 0
      ? [
          "\\section*{References}",
          "\\begin{enumerate}",
          ...references.map((r) => `  \\item ${escapeLatex(r)}`),
          "\\end{enumerate}",
        ].join("\n")
      : "";

  return [
    "\\documentclass[11pt]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{hyperref}",
    "\\usepackage[round]{natbib}",
    "\\usepackage{geometry}",
    "\\geometry{margin=1in}",
    "\\usepackage{setspace}",
    "\\onehalfspacing",
    "",
    `\\title{${escapeLatex(doc.title)}}`,
    "\\author{}",
    "\\date{\\today}",
    "",
    "\\begin{document}",
    "\\maketitle",
    "",
    body,
    "",
    bibSection,
    "",
    "\\end{document}",
    "",
  ].filter(Boolean).join("\n");
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
    ...flattenBlocks(doc.content).map((b) =>
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

/** Compile LaTeX to PDF via an external service (latexonline.cc). */
async function compileLatexToPdf(texSource: string, bibSource: string): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", new Blob([texSource], { type: "application/x-tex" }), "main.tex");
  if (bibSource) {
    formData.append("file", new Blob([bibSource], { type: "application/x-bib" }), `${slugify("document")}.bib`);
  }

  const res = await fetch("https://latexonline.cc/compile", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "Compilation failed");
    throw new Error(`LaTeX compilation failed: ${err.slice(0, 200)}`);
  }

  return await res.blob();
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
  sources: PaperSource[] = [],
): Promise<void> {
  const base = slugify(doc.title);

  if (format === "docx") {
    const blob = await docToDocxBlob(doc, references);
    triggerDownload(blob, `${base}.${EXTENSION.docx}`);
    return;
  }

  if (format === "bibtex") {
    const text = docToBibTeX(sources);
    triggerDownload(new Blob([text], { type: "text/plain;charset=utf-8" }), `${base}.bib`);
    return;
  }

  if (format === "latex") {
    const tex = docToLatex(doc, sources, references);
    const bib = docToBibTeX(sources);
    triggerDownload(new Blob([tex], { type: "application/x-tex" }), `${base}.tex`);
    if (sources.length > 0) {
      triggerDownload(new Blob([bib], { type: "text/plain;charset=utf-8" }), `${base}.bib`);
    }
    return;
  }

  if (format === "pdf") {
    const tex = docToLatex(doc, sources, references);
    const bib = docToBibTeX(sources);
    try {
      const blob = await compileLatexToPdf(tex, bib);
      triggerDownload(blob, `${base}.pdf`);
    } catch (err) {
      // Fallback: download the .tex so the user can compile locally
      triggerDownload(new Blob([tex], { type: "application/x-tex" }), `${base}.tex`);
      throw new Error("PDF compilation failed. Downloaded .tex file instead — compile with your local LaTeX distribution.");
    }
    return;
  }

  const text =
    format === "markdown"
      ? docToMarkdown(doc, references)
      : docToPlainText(doc, references);

  triggerDownload(new Blob([text], { type: "text/plain;charset=utf-8" }), `${base}.${EXTENSION[format]}`);
}
