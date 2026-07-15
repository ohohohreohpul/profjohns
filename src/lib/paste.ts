import type { PaperSource } from "./mock";

export type PasteKind = "url" | "doi" | "text";

const URL_RE = /^https?:\/\/\S+$/i;
const DOI_RE = /^10\.\d{4,9}\/\S+$/i;

/** Classify pasted clipboard text into what kind of node it should become. */
export function classifyPaste(text: string): PasteKind {
  const t = text.trim();
  if (URL_RE.test(t)) return "url";
  if (DOI_RE.test(t)) return "doi";
  return "text";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

/** Build a lightweight PaperSource from a pasted URL or DOI. */
export function paperFromUrl(input: string, kind: PasteKind): PaperSource {
  const url = kind === "doi" ? `https://doi.org/${input.trim()}` : input.trim();
  const arxiv = url.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?#]+)/i);
  const title = arxiv
    ? `arXiv:${arxiv[1].replace(/\.pdf$/i, "")}`
    : kind === "doi"
      ? input.trim()
      : url.replace(/^https?:\/\//, "").slice(0, 80);

  return {
    id: url,
    title,
    authors: "Web source",
    venue: arxiv ? "arXiv" : hostOf(url),
    year: new Date().getFullYear(),
    abstract: "Open in the reader to fetch the full text.",
    url,
  };
}
