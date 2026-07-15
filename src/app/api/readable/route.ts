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

    const html = await res.text();
    return NextResponse.json({
      success: true,
      data: { kind: "html", text: stripHtml(html), resolvedUrl: target },
      error: null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, data: null, error: getErrorMessage(error) },
      { status: 502 },
    );
  }
}
