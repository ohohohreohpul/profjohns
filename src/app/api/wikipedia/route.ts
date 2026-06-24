import { NextRequest, NextResponse } from "next/server";
import type { PaperSource } from "@/lib/mock";

/**
 * Free Wikipedia search — no API key needed.
 * Returns up to 8 articles matching the query.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json(
      { success: false, data: null, error: "Enter a search query." },
      { status: 400 },
    );
  }

  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=8`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "ProfJohns/1.0" },
    });
    const json = (await res.json()) as {
      query?: { search?: { title: string; snippet: string; timestamp: string }[] };
    };

    const results = json.query?.search ?? [];
    const papers: PaperSource[] = results.map((r, i) => ({
      id: `wiki-${encodeURIComponent(r.title)}`,
      title: r.title,
      authors: "Wikipedia",
      venue: "Wikipedia",
      year: Number.parseInt(r.timestamp.slice(0, 4)) || new Date().getFullYear(),
      abstract: r.snippet.replace(/<[^>]+>/g, ""),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
      category: "Encyclopedia",
    }));

    return NextResponse.json({ success: true, data: papers, error: null });
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: "Wikipedia search failed." },
      { status: 502 },
    );
  }
}