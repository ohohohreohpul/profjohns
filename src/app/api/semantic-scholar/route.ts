import { NextRequest, NextResponse } from "next/server";
import type { PaperSource } from "@/lib/mock";

/**
 * Proxies the public Semantic Scholar Graph API (no key required, rate
 * limited). Returns the same PaperSource shape as the arXiv route so the UI
 * is provider-agnostic.
 */

const ENDPOINT = "https://api.semanticscholar.org/graph/v1/paper/search";
const FIELDS = "title,authors,year,abstract,venue,citationCount,url";
const LIMIT = 8;

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface S2Paper {
  paperId?: string;
  title?: string;
  abstract?: string;
  venue?: string;
  year?: number;
  citationCount?: number;
  url?: string;
  authors?: Array<{ name?: string }>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function formatAuthors(authors: S2Paper["authors"]): string {
  const names = (authors ?? []).map((a) => a.name?.trim()).filter(Boolean);
  if (names.length === 0) return "Unknown authors";
  if (names.length > 3) return `${names[0]} et al.`;
  return names.join(", ");
}

function mapPaper(paper: S2Paper): PaperSource {
  return {
    id: paper.paperId ?? paper.title ?? "unknown",
    title: (paper.title ?? "").trim(),
    authors: formatAuthors(paper.authors),
    venue: paper.venue?.trim() || "Semantic Scholar",
    year: paper.year ?? new Date().getFullYear(),
    abstract: (paper.abstract ?? "No abstract available.").trim(),
    citations: paper.citationCount,
    url: paper.url,
  };
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<PaperSource[]>>> {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json(
      { success: false, data: null, error: "Missing search query." },
      { status: 400 },
    );
  }

  const url = `${ENDPOINT}?query=${encodeURIComponent(
    query,
  )}&limit=${LIMIT}&fields=${FIELDS}`;

  // A free Semantic Scholar API key (SEMANTIC_SCHOLAR_API_KEY) lifts the
  // aggressive shared rate limit on the keyless endpoint.
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  const headers: Record<string, string> = {
    "User-Agent": "ProfJohns/0.1 (research canvas prototype)",
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(
        res.status === 429
          ? "Semantic Scholar is rate limiting — try again shortly."
          : `Semantic Scholar responded with ${res.status}`,
      );
    }
    const json = (await res.json()) as { data?: S2Paper[] };
    const papers = (json.data ?? []).map(mapPaper).filter((p) => p.title);
    return NextResponse.json({ success: true, data: papers, error: null });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, data: null, error: getErrorMessage(error) },
      { status: 502 },
    );
  }
}
