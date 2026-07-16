import { NextRequest, NextResponse } from "next/server";
import type { PaperSource } from "@/lib/mock";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/server-auth";
import { canUseLocalMode } from "@/lib/config/env";
import { checkRateLimits, getClientIP, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * CrossRef search provider — verifies citations and finds papers by DOI.
 * Free API (no key needed, polite pool with mailto).
 * https://api.crossref.org/works
 */

const ENDPOINT = "https://api.crossref.org/works";
const LIMIT = 8;
const MAILTO = process.env.OPENALEX_MAILTO ?? "research@profjohns.com";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface CrossRefWork {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  "container-title"?: string[];
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  abstract?: string;
  "is-referenced-by-count"?: number;
  URL?: string;
  type?: string;
}

function formatAuthors(authors: CrossRefWork["author"]): string {
  const names = (authors ?? [])
    .map((a) => [a.given, a.family].filter(Boolean).join(" "))
    .filter(Boolean);
  if (names.length === 0) return "Unknown authors";
  if (names.length > 3) return `${names[0]} et al.`;
  return names.join(", ");
}

function getYear(work: CrossRefWork): number {
  const parts = work["published-print"]?.["date-parts"]?.[0] ?? work["published-online"]?.["date-parts"]?.[0];
  return parts?.[0] ?? new Date().getFullYear();
}

function stripAbstract(abstract?: string): string {
  if (!abstract) return "No abstract available.";
  return abstract
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000) || "No abstract available.";
}

function mapWork(work: CrossRefWork): PaperSource {
  const title = (work.title?.[0] ?? "Untitled").trim();
  return {
    id: work.DOI ?? title,
    title,
    authors: formatAuthors(work.author),
    venue: work["container-title"]?.[0]?.trim() || "CrossRef",
    year: getYear(work),
    abstract: stripAbstract(work.abstract),
    doi: work.DOI,
    citations: work["is-referenced-by-count"],
    url: work.URL ?? (work.DOI ? `https://doi.org/${work.DOI}` : undefined),
    openAccess: false,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaperSource[]>>> {
  // Auth
  if (!canUseLocalMode()) {
    try {
      await requireUser();
    } catch (error) {
      if (error instanceof AuthError) return authErrorResponse(error) as NextResponse<ApiResponse<PaperSource[]>>;
      throw error;
    }
  }

  // Rate limit
  const ip = getClientIP(request);
  const rl = checkRateLimits("api", ip, "/api/crossref", RATE_LIMITS.readable);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, data: null, error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim();
  const doi = request.nextUrl.searchParams.get("doi")?.trim();

  if (!query && !doi) {
    return NextResponse.json(
      { success: false, data: null, error: "Missing query or DOI." },
      { status: 400 },
    );
  }

  try {
    let url: string;
    if (doi) {
      // Direct DOI lookup
      url = `${ENDPOINT}/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(MAILTO)}`;
    } else {
      // Text search
      url = `${ENDPOINT}?rows=${LIMIT}&query=${encodeURIComponent(query!)}&mailto=${encodeURIComponent(MAILTO)}`;
    }

    const res = await fetch(url, {
      headers: { "User-Agent": `ProfJohns (${MAILTO})` },
    });

    if (!res.ok) {
      throw new Error(res.status === 429 ? "CrossRef is busy. Try again." : `CrossRef returned ${res.status}.`);
    }

    const json = (await res.json()) as { message?: CrossRefWork | CrossRefWork[] };

    let works: CrossRefWork[];
    if (doi) {
      // DOI lookup returns a single work
      works = json.message ? [json.message as CrossRefWork] : [];
    } else {
      // Search returns an array
      works = (json.message as { items?: CrossRefWork[] })?.items ?? [];
      if (!Array.isArray(works)) works = [];
    }

    const papers = works.map(mapWork).filter((p) => p.title.length > 0);
    return NextResponse.json({ success: true, data: papers, error: null });
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "CrossRef search failed." },
      { status: 502 },
    );
  }
}
