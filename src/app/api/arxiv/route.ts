import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import type { PaperSource } from "@/lib/mock";

/**
 * Proxies the public arXiv Atom API (no key required) and maps the feed to
 * our PaperSource shape. Runs server-side so the browser avoids CORS and the
 * XML parsing stays off the client bundle.
 */

const ARXIV_ENDPOINT = "http://export.arxiv.org/api/query";
const MAX_RESULTS = 8;

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface ArxivAuthor {
  name?: string;
}

interface ArxivEntry {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  author?: ArxivAuthor | ArxivAuthor[];
  category?: { "@_term"?: string } | Array<{ "@_term"?: string }>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function clean(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function formatAuthors(author: ArxivEntry["author"]): string {
  const names = (Array.isArray(author) ? author : author ? [author] : [])
    .map((a) => clean(a.name))
    .filter(Boolean);
  if (names.length === 0) return "Unknown authors";
  if (names.length > 3) return `${names[0]} et al.`;
  return names.join(", ");
}

function arxivId(rawId: string | undefined): string {
  const id = clean(rawId);
  return id.split("/abs/")[1] ?? id;
}

function mapEntry(entry: ArxivEntry): PaperSource {
  const category = Array.isArray(entry.category)
    ? entry.category[0]?.["@_term"]
    : entry.category?.["@_term"];
  const year = Number.parseInt(clean(entry.published).slice(0, 4), 10);
  const id = arxivId(entry.id);
  return {
    id: id || clean(entry.title),
    title: clean(entry.title),
    authors: formatAuthors(entry.author),
    venue: "arXiv",
    year: Number.isNaN(year) ? new Date().getFullYear() : year,
    abstract: clean(entry.summary),
    url: clean(entry.id),
    category,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaperSource[]>>> {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { success: false, data: null, error: "Missing search query." },
      { status: 400 },
    );
  }

  const url = `${ARXIV_ENDPOINT}?search_query=${encodeURIComponent(
    `all:${query}`,
  )}&start=0&max_results=${MAX_RESULTS}&sortBy=relevance&sortOrder=descending`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ProfJohns/0.1 (research canvas prototype)" },
    });
    if (!res.ok) {
      throw new Error(`arXiv responded with ${res.status}`);
    }

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const entries: ArxivEntry[] | ArxivEntry | undefined = parsed?.feed?.entry;
    const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
    const papers = list.map(mapEntry).filter((p) => p.title);

    return NextResponse.json({ success: true, data: papers, error: null });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, data: null, error: getErrorMessage(error) },
      { status: 502 },
    );
  }
}
