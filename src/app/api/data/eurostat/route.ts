import { NextRequest, NextResponse } from "next/server";

/**
 * Eurostat data provider — fetches EU statistics.
 * Free API, no key needed.
 * https://ec.europa.eu/eurostat/api/dissemination/
 */

export async function GET(request: NextRequest) {
  const dataset = request.nextUrl.searchParams.get("dataset");
  const search = request.nextUrl.searchParams.get("search");

  try {
    if (search) {
      // Search for datasets by keyword
      const url = `https://ec.europa.eu/eurostat/api/dissemination/catalogue/estat/navtree1.json?search=${encodeURIComponent(search)}&searchType=label&lang=en`;
      const res = await fetch(url);
      const json = (await res.json()) as { class?: string; label?: string; id?: string; children?: unknown[] };
      return NextResponse.json({ success: true, data: json });
    }

    if (!dataset) {
      return NextResponse.json({ success: false, error: "Missing dataset code (e.g. nama_10_gdp)" }, { status: 400 });
    }

    const url = `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/${encodeURIComponent(dataset)}?format=JSON&lang=en`;
    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Eurostat returned ${res.status}` }, { status: 502 });
    }

    const json = await res.json();
    return NextResponse.json({ success: true, data: json });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Eurostat fetch failed" }, { status: 502 });
  }
}
