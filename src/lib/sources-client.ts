import type { PaperSource } from "./mock";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export type SourceProvider = "openalex" | "arxiv" | "semanticscholar" | "wikipedia";

export const PROVIDER_LABEL: Record<SourceProvider, string> = {
  openalex: "OpenAlex",
  arxiv: "arXiv",
  semanticscholar: "Semantic Scholar",
  wikipedia: "Wikipedia",
};

export const PROVIDER_ORDER: SourceProvider[] = [
  "openalex",
  "arxiv",
  "semanticscholar",
  "wikipedia",
];

const PROVIDER_PATH: Record<SourceProvider, string> = {
  openalex: "/api/openalex",
  arxiv: "/api/arxiv",
  semanticscholar: "/api/semantic-scholar",
  wikipedia: "/api/wikipedia",
};

/** Search a paper provider through its server route, with one retry on
 * transient failure (public indexes occasionally rate-limit or hiccup). */
export async function searchProvider(
  provider: SourceProvider,
  query: string,
): Promise<PaperSource[]> {
  const path = `${PROVIDER_PATH[provider]}?q=${encodeURIComponent(query)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(path);
      const json = (await res.json()) as ApiResponse<PaperSource[]>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Search failed. Please try again.");
      }
      return json.data ?? [];
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return [];
}

interface PdfResult {
  text: string;
  pages: number;
}

const ABSTRACT_PREVIEW = 600;

/** Upload a PDF, extract its text, and turn it into a PaperSource. */
export async function uploadPdf(file: File): Promise<PaperSource> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/pdf", { method: "POST", body: form });
  const json = (await res.json()) as ApiResponse<PdfResult>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Could not read that PDF.");
  }

  const title = file.name.replace(/\.pdf$/i, "");
  return {
    id: `pdf-${title}-${file.size}`,
    title,
    authors: "Uploaded PDF",
    venue: "PDF",
    year: new Date().getFullYear(),
    abstract:
      json.data.text.slice(0, ABSTRACT_PREVIEW) +
      (json.data.text.length > ABSTRACT_PREVIEW ? "…" : ""),
    category: `${json.data.pages} pages`,
  };
}
