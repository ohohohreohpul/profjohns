import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/server-auth";
import { canUseLocalMode } from "@/lib/config/env";
import { checkRateLimits, getClientIP, RATE_LIMITS } from "@/lib/security/rate-limit";
import { recordUsage } from "@/lib/security/usage";

/**
 * Extracts text from an uploaded PDF server-side (unpdf is serverless-safe and
 * needs no worker setup). Returns plain text the client turns into a source.
 *
 * Protected by authentication and rate limiting.
 */

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface PdfResult {
  text: string;
  pages: number;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<PdfResult>>> {
  // Authentication
  let user;
  try {
    if (canUseLocalMode()) {
      user = { id: "local-user" };
    } else {
      const authedUser = await requireUser();
      user = { id: authedUser.id };
    }
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error) as NextResponse<ApiResponse<PdfResult>>;
    throw error;
  }

  // Rate limiting
  const ip = getClientIP(request);
  const rateResult = checkRateLimits(user.id, ip, "/api/pdf", RATE_LIMITS.pdf);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { success: false, data: null, error: "Rate limit exceeded. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateResult.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, data: null, error: "No PDF file provided." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, data: null, error: "PDF exceeds the 20 MB limit." },
        { status: 413 },
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text, totalPages } = await extractText(pdf, { mergePages: true });

    void recordUsage({
      userId: user.id,
      vendor: "unpdf",
      model: null,
      requestType: "pdf-extract",
      estimatedCostUsd: null,
      actualTokenUsage: null,
      status: "success",
      errorMessage: null,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: { text: text.replace(/\s+/g, " ").trim(), pages: totalPages },
      error: null,
    });
  } catch (error: unknown) {
    void recordUsage({
      userId: user.id,
      vendor: "unpdf",
      model: null,
      requestType: "pdf-extract",
      estimatedCostUsd: null,
      actualTokenUsage: null,
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: false, data: null, error: "Failed to extract text from the PDF." },
      { status: 502 },
    );
  }
}
