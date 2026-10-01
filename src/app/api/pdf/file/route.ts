import { NextRequest, NextResponse } from "next/server";
import { safeFetch, UnsafeUrlError } from "@/lib/server/safe-fetch";
import { toPdfUrl } from "@/lib/pdf-url";

/**
 * Same-origin PDF proxy for the in-app PDF reader: browsers can't read other
 * sites' PDFs directly (CORS). SSRF-guarded via safeFetch; only real PDFs
 * (by magic bytes) are returned.
 */

export const runtime = "nodejs";

const MAX_PDF_BYTES = 40 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;
const CACHE_SECONDS = 3600;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function isPdf(bytes: Uint8Array): boolean {
  // Some servers prepend whitespace/BOM; look in the first kilobyte.
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + PDF_MAGIC.length <= head.length; i++) {
    if (PDF_MAGIC.every((b, j) => head[i + j] === b)) return true;
  }
  return false;
}

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, data: null, error }, { status });
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim();
  if (!raw) return fail("A PDF link is required.", 400);

  try {
    const { bytes } = await safeFetch(toPdfUrl(raw), {
      maxBytes: MAX_PDF_BYTES,
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: { "User-Agent": "ProfJohns/1.0 (research reader)", Accept: "application/pdf,*/*;q=0.8" },
    });
    if (!isPdf(bytes)) {
      return fail("This source didn't return a PDF (the publisher may require a login). Open the original instead.", 422);
    }
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": `private, max-age=${CACHE_SECONDS}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    if (error instanceof UnsafeUrlError) return fail(error.message, 400);
    const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
    return fail(timedOut ? "The PDF took too long to download. Try again." : "Couldn't download this PDF.", 502);
  }
}
