import type { PaperSource } from "./mock";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface LinkPreview {
  url: string;
  resolvedUrl: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  publishedYear: number | null;
}

/** Fetch Open Graph / meta preview data for a web URL via the server route. */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
  const json = (await res.json()) as ApiResponse<LinkPreview>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Could not load this link.");
  }
  return json.data;
}

/** Bare hostname, www stripped — used as the venue/site label. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Today's date as a short, locale-stable accessed stamp (e.g. "24 Jun 2026"). */
function accessedToday(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Normalize a web link into a PaperSource so it flows through the same
 * dataflow / Reader / citation machinery as scholarly sources. Site name maps
 * to author, domain to venue; `accessed` marks it as a web source for the
 * citation formatters.
 */
export function previewToSource(preview: LinkPreview): PaperSource {
  const host = hostOf(preview.resolvedUrl || preview.url);
  return {
    id: `link-${preview.resolvedUrl || preview.url}`,
    title: preview.title || host,
    authors: preview.siteName || host,
    venue: host,
    year: preview.publishedYear ?? new Date().getFullYear(),
    abstract: preview.description || "",
    url: preview.resolvedUrl || preview.url,
    category: "Web",
    accessed: accessedToday(),
  };
}
