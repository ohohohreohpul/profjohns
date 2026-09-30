import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * Fetches a source URL and returns readable text for in-app reading (no new
 * tab, no iframe — which academic sites block). For arXiv (and any PDF) it
 * pulls the full paper text via unpdf; otherwise it strips HTML to text.
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

/** Shown in the Reader (above the abstract) when the publisher won't serve text. */
const BLOCKED_MESSAGE =
  "This publisher blocks automated reading, so only the abstract is shown. Open the original to read the full paper.";

/** HTTP statuses publishers use for bot walls and rate limits. */
const BLOCKED_STATUSES = new Set([401, 403, 429, 503]);

/** Phrases from bot-check / JS-challenge / access-denied interstitials. */
const CHALLENGE_MARKERS = [
  /client challenge/i,
  /enable javascript (?:and cookies )?to (?:proceed|continue)/i,
  /javascript is (?:disabled|required)/i,
  /just a moment\.\.\./i,
  /checking (?:if the site connection is secure|your browser)/i,
  /verify(?:ing)? (?:you are|that you're) (?:a )?human/i,
  /are you a robot/i,
  /captcha/i,
  /access denied/i,
];

/** Interstitials are short; a real article is not. */
const CHALLENGE_MAX_CHARS = 2000;
const MIN_READABLE_CHARS = 400;

class BlockedSourceError extends Error {
  constructor() {
    super(BLOCKED_MESSAGE);
    this.name = "BlockedSourceError";
  }
}

/** True when stripped page text is a bot wall or too thin to be the paper. */
function isUnreadable(text: string): boolean {
  if (text.length < MIN_READABLE_CHARS) return true;
  return (
    text.length < CHALLENGE_MAX_CHARS &&
    CHALLENGE_MARKERS.some((marker) => marker.test(text))
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
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
  const url = request.nextUrl.searchParams.get("url")?.trim();

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { success: false, data: null, error: "A valid http(s) URL is required." },
      { status: 400 },
    );
  }

  const { target, expectPdf } = resolveTarget(url);

  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "ProfJohns/0.1 (research canvas prototype)" },
    });
    if (BLOCKED_STATUSES.has(res.status)) {
      throw new BlockedSourceError();
    }
    if (!res.ok) {
      throw new Error(`Source responded with ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    const isPdf = expectPdf || contentType.includes("pdf");

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
          resolvedUrl: target,
        },
        error: null,
      });
    }

    const text = stripHtml(await res.text());
    if (isUnreadable(text)) {
      throw new BlockedSourceError();
    }
    return NextResponse.json({
      success: true,
      data: { kind: "html", text, resolvedUrl: target },
      error: null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, data: null, error: getErrorMessage(error) },
      // 422: we reached the source but it wouldn't give us readable text.
      { status: error instanceof BlockedSourceError ? 422 : 502 },
    );
  }
}
