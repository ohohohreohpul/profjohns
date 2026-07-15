import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { safeFetch, SsrfError } from "@/lib/security/safe-fetch";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/server-auth";
import { canUseLocalMode } from "@/lib/config/env";
import { checkRateLimits, getClientIP, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * Fetches a source URL and returns readable text for in-app reading (no new
 * tab, no iframe — which academic sites block). For arXiv (and any PDF) it
 * pulls the full paper text via unpdf; otherwise it strips HTML to text.
 *
 * Protected by authentication, rate limiting, and SSRF-safe fetching.
 */

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface ReadableResult {
  kind: "pdf" | "html";
  text: string;
  pages?: number;
  resolvedUrl: string;
}

/** Map an arXiv abstract/html URL to its PDF so we can read the full text. */
function resolveTarget(url: string): { target: string; expectPdf: boolean } {
  const arxiv = url.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?#]+)/i);
  if (arxiv) {
    const id = arxiv[1].replace(/\.pdf$/i, "");
    return { target: `https://arxiv.org/pdf/${id}`, expectPdf: true };
  }
  return { target: url, expectPdf: /\.pdf($|\?)/i.test(url) };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ReadableResult>>> {
  // Authentication
  let userId: string;
  try {
    if (canUseLocalMode()) {
      userId = "local-user";
    } else {
      const user = await requireUser();
      userId = user.id;
    }
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error) as NextResponse<ApiResponse<ReadableResult>>;
    throw error;
  }

  // Rate limiting
  const ip = getClientIP(request);
  const rateResult = checkRateLimits(userId, ip, "/api/readable", RATE_LIMITS.readable);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { success: false, data: null, error: "Rate limit exceeded. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateResult.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const url = request.nextUrl.searchParams.get("url")?.trim();

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { success: false, data: null, error: "A valid http(s) URL is required." },
      { status: 400 },
    );
  }

  const { target, expectPdf } = resolveTarget(url);

  try {
    const res = await safeFetch(target, {
      timeoutMs: 15_000,
      maxBytes: 10_000_000, // 10MB max for PDFs/articles
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, data: null, error: `Source responded with ${res.status}.` },
        { status: 502 },
      );
    }

    const isPdf = expectPdf || res.contentType.includes("pdf");

    if (isPdf) {
      const buffer = new Uint8Array(await res.arrayBuffer());
      const pdf = await getDocumentProxy(buffer);
      const { text, totalPages } = await extractText(pdf, { mergePages: true });
      return NextResponse.json({
        success: true,
        data: {
          kind: "pdf",
          text: text.replace(/\s+/g, " ").trim(),
          pages: totalPages,
          resolvedUrl: res.finalUrl,
        },
        error: null,
      });
    }

    const html = await res.text();
    return NextResponse.json({
      success: true,
      data: { kind: "html", text: stripHtml(html), resolvedUrl: res.finalUrl },
      error: null,
    });
  } catch (error: unknown) {
    const message = error instanceof SsrfError
      ? error.message
      : "Failed to fetch the source URL.";

    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: error instanceof SsrfError ? 400 : 502 },
    );
  }
}
