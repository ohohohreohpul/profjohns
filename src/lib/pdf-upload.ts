/**
 * Upload a PDF the user drops or picks: validate, read its metadata, store
 * it in the user's private Supabase folder, and describe it as a paper.
 * Signed out (local development only), it stays as an in-browser blob.
 */
import type { PaperSource } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_PDF_PREFIX } from "@/lib/pdf-url";

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const ABSTRACT_CHARS = 900;
const MIN_TITLE_CHARS = 4;

export class PdfUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfUploadError";
  }
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** "smith_2021-bandits-FINAL.pdf" -> "smith 2021 bandits FINAL" */
export function titleFromFilename(name: string): string {
  return name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled PDF";
}

/** PDF "D:20210506..." creation date -> 2021 */
export function yearFromPdfDate(raw: unknown): number | undefined {
  const m = typeof raw === "string" ? raw.match(/(?:D:)?(\d{4})/) : null;
  const year = m ? Number(m[1]) : NaN;
  return year >= 1900 && year <= new Date().getFullYear() + 1 ? year : undefined;
}

interface TextItem {
  str?: string;
  height?: number;
  /** pdf.js text matrix [a, b, c, d, e, f]; b/c non-zero means rotated. */
  transform?: number[];
}

const TITLE_HEIGHT_RATIO = 0.9;
const ROTATION_EPSILON = 0.01;
/** arXiv stamps "arXiv:2105.02723v1 [cs.CV] 6 May 2021" sideways in the margin. */
const ARXIV_STAMP = /^arxiv:\s*\d/i;

function isHorizontal(i: TextItem): boolean {
  const [, b = 0, c = 0] = i.transform ?? [];
  return Math.abs(b) < ROTATION_EPSILON && Math.abs(c) < ROTATION_EPSILON;
}
const MAX_TITLE_CHARS = 220;

/**
 * Papers rarely fill the PDF Title field (arXiv often leaves it empty), but
 * the title is almost always the largest text on page 1.
 */
export function titleFromLargestText(items: readonly TextItem[]): string | undefined {
  const sized = items.filter(
    (i) => (i.str ?? "").trim() && (i.height ?? 0) > 0 && isHorizontal(i) && !ARXIV_STAMP.test((i.str ?? "").trim()),
  );
  if (sized.length === 0) return undefined;
  const max = Math.max(...sized.map((i) => i.height ?? 0));
  const title = sized
    .filter((i) => (i.height ?? 0) >= max * TITLE_HEIGHT_RATIO)
    .map((i) => i.str?.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return title.length >= MIN_TITLE_CHARS && title.length <= MAX_TITLE_CHARS ? title : undefined;
}

interface PdfInfo {
  title?: string;
  author?: string;
  year?: number;
  firstPageText: string;
}

async function readPdfInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const { getResolvedPDFJS } = await import("unpdf");
  const pdfjs = (await getResolvedPDFJS()) as unknown as {
    getDocument: (o: { data: Uint8Array; isEvalSupported: boolean }) => {
      promise: Promise<{
        getMetadata: () => Promise<{ info?: Record<string, unknown> }>;
        getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: TextItem[] }> }>;
        destroy: () => Promise<void>;
      }>;
    };
  };
  // pdf.js takes ownership of the buffer it's given, so hand it a copy.
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  try {
    const info = (await doc.getMetadata()).info ?? {};
    const items = (await (await doc.getPage(1)).getTextContent()).items;
    const text = items.map((i) => i.str ?? "").join(" ");
    const metaTitle = typeof info.Title === "string" && info.Title.trim().length >= MIN_TITLE_CHARS ? info.Title.trim() : undefined;
    const title = metaTitle ?? titleFromLargestText(items);
    const author = typeof info.Author === "string" && info.Author.trim() ? info.Author.trim() : undefined;
    return { title, author, year: yearFromPdfDate(info.CreationDate), firstPageText: text.replace(/\s+/g, " ").trim() };
  } finally {
    void doc.destroy();
  }
}

export async function uploadPdf(file: File): Promise<PaperSource> {
  if (!isPdfFile(file)) throw new PdfUploadError("That file isn't a PDF.");
  if (file.size > MAX_UPLOAD_BYTES) throw new PdfUploadError("That PDF is over 40 MB. Try a smaller file.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = await readPdfInfo(bytes).catch(() => {
    throw new PdfUploadError("That PDF couldn't be read. It may be damaged or password-protected.");
  });

  const id = crypto.randomUUID();
  let pdfUrl: string;
  const sb = createClient();
  const session = sb ? (await sb.auth.getSession()).data.session : null;
  if (sb && session) {
    const path = `${session.user.id}/pdfs/${id}.pdf`;
    const { error } = await sb.storage.from("media").upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) throw new PdfUploadError("Couldn't upload that PDF. Check your connection and try again.");
    pdfUrl = `${STORAGE_PDF_PREFIX}${path}`;
  } else {
    pdfUrl = URL.createObjectURL(file);
  }

  return {
    id: `upload-${id}`,
    title: info.title ?? titleFromFilename(file.name),
    // Empty when unknown: citations then fall back to the title.
    authors: info.author ?? "",
    venue: "Uploaded PDF",
    year: info.year ?? new Date().getFullYear(),
    abstract: info.firstPageText.slice(0, ABSTRACT_CHARS) || "No abstract available.",
    pdfUrl,
    openAccess: true,
  };
}
