import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/server-auth";
import { canUseLocalMode } from "@/lib/config/env";

/**
 * Citation verification — checks if a citation exists in CrossRef/OpenAlex.
 *
 * Takes a source (title, authors, year, DOI) and verifies it against:
 *   1. CrossRef DOI lookup (exact match)
 *   2. CrossRef title search (fuzzy match)
 *
 * Returns verification status + confidence.
 */

const verifySchema = z.object({
  title: z.string().min(1),
  authors: z.string().optional(),
  year: z.number().int().optional(),
  doi: z.string().optional(),
});

interface VerifyResult {
  verified: boolean;
  source: "crossref_doi" | "crossref_title" | "not_found";
  matchedDoi: string | null;
  matchedTitle: string | null;
  confidence: number;
  message: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (canUseLocalMode()) {
    return NextResponse.json({ verified: true, source: "local", confidence: 1, message: "Local mode" });
  }

  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  let body: z.infer<typeof verifySchema>;
  try {
    body = verifySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const MAILTO = process.env.OPENALEX_MAILTO ?? "research@profjohns.com";
  const headers = { "User-Agent": `ProfJohns (${MAILTO})` };

  try {
    // Strategy 1: Direct DOI lookup (highest confidence)
    if (body.doi) {
      const cleanDoi = body.doi.replace(/^https?:\/\/doi\.org\//i, "");
      const res = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}?mailto=${encodeURIComponent(MAILTO)}`,
        { headers },
      );
      if (res.ok) {
        const json = (await res.json()) as { message?: { title?: string[]; DOI?: string } };
        const matchedTitle = json.message?.title?.[0]?.trim();
        const matchedDoi = json.message?.DOI;
        if (matchedDoi) {
          // Verify title similarity
          const titleMatch = matchedTitle && matchedTitle.toLowerCase().includes(body.title.toLowerCase().slice(0, 30));
          return NextResponse.json({
            verified: true,
            source: "crossref_doi",
            matchedDoi: matchedDoi ?? null,
            matchedTitle: matchedTitle ?? null,
            confidence: titleMatch ? 1.0 : 0.8,
            message: "Verified via DOI",
          } satisfies VerifyResult);
        }
      }
    }

    // Strategy 2: Title search in CrossRef
    const searchUrl = `https://api.crossref.org/works?rows=3&query.title=${encodeURIComponent(body.title)}&mailto=${encodeURIComponent(MAILTO)}`;
    const res = await fetch(searchUrl, { headers });

    if (!res.ok) {
      return NextResponse.json({
        verified: false,
        source: "not_found",
        matchedDoi: null,
        matchedTitle: null,
        confidence: 0,
        message: "CrossRef search failed",
      } satisfies VerifyResult);
    }

    const json = (await res.json()) as {
      message?: { items?: Array<{ title?: string[]; DOI?: string; "published-print"?: { "date-parts"?: number[][] } }> }
    };

    const items = json.message?.items ?? [];
    for (const item of items) {
      const itemTitle = item.title?.[0]?.trim().toLowerCase() ?? "";
      if (!itemTitle) continue;

      // Fuzzy match: check if titles share significant word overlap
      const queryWords = body.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const itemWords = itemTitle.split(/\s+/).filter((w) => w.length > 3);
      const overlap = queryWords.filter((w) => itemWords.includes(w));
      const similarity = queryWords.length > 0 ? overlap.length / queryWords.length : 0;

      if (similarity >= 0.6) {
        return NextResponse.json({
          verified: true,
          source: "crossref_title",
          matchedDoi: item.DOI ?? null,
          matchedTitle: item.title?.[0]?.trim() ?? null,
          confidence: similarity,
          message: `Matched by title (${Math.round(similarity * 100)}% overlap)`,
        } satisfies VerifyResult);
      }
    }

    return NextResponse.json({
      verified: false,
      source: "not_found",
      matchedDoi: null,
      matchedTitle: null,
      confidence: 0,
      message: "No matching source found in CrossRef",
    } satisfies VerifyResult);
  } catch (error) {
    console.error("[Verify] Error:", error);
    return NextResponse.json({
      verified: false,
      source: "not_found",
      matchedDoi: null,
      matchedTitle: null,
      confidence: 0,
      message: "Verification service unavailable",
    } satisfies VerifyResult);
  }
}
