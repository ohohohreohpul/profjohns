import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extracts text from an uploaded PDF server-side (unpdf is serverless-safe and
 * needs no worker setup). Returns plain text the client turns into a source.
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<PdfResult>>> {
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

    return NextResponse.json({
      success: true,
      data: { text: text.replace(/\s+/g, " ").trim(), pages: totalPages },
      error: null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, data: null, error: getErrorMessage(error) },
      { status: 502 },
    );
  }
}
