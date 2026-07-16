import { NextRequest, NextResponse } from "next/server";

/**
 * World Bank data provider — fetches economic/social indicators.
 * Free API, no key needed.
 * https://api.worldbank.org/v2/
 */

export async function GET(request: NextRequest) {
  const indicator = request.nextUrl.searchParams.get("indicator");
  const countries = request.nextUrl.searchParams.get("countries") ?? "USA";
  const startYear = request.nextUrl.searchParams.get("start") ?? "2020";
  const endYear = request.nextUrl.searchParams.get("end") ?? "2023";
  const search = request.nextUrl.searchParams.get("search");

  try {
    if (search) {
      // Search for indicators by keyword
      const url = `https://api.worldbank.org/v2/indicator?format=json&per_page=20&prefix=JSON&q=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const json = (await res.json()) as [unknown, Array<{ id: string; name: string; sourceNote?: string }>];
      const items = Array.isArray(json) && json[1] ? json[1] : [];
      return NextResponse.json({
        success: true,
        data: items.map((i) => ({ id: i.id, name: i.name, description: i.sourceNote })),
      });
    }

    if (!indicator) {
      return NextResponse.json({ success: false, error: "Missing indicator code (e.g. NY.GDP.MKTP.CD) or use ?search=keyword" }, { status: 400 });
    }

    const countryList = countries.split(";").map((c) => c.trim()).join(";");
    const url = `https://api.worldbank.org/v2/country/${countryList}/indicator/${indicator}?format=json&date=${startYear}:${endYear}&per_page=200`;
    const res = await fetch(url);
    const json = (await res.json()) as [unknown, Array<{ country?: { id: string; value: string }; date: string; value: number | null; indicator?: { id: string; value: string } } | null>];

    if (!Array.isArray(json) || json.length < 2) {
      return NextResponse.json({ success: false, error: "No data found." }, { status: 404 });
    }

    const records = (json[1] ?? []).filter(Boolean);
    const series: Record<string, { year: string; value: number | null }[]> = {};

    for (const rec of records) {
      if (!rec) continue;
      const country = rec.country?.value ?? "Unknown";
      if (!series[country]) series[country] = [];
      series[country].push({ year: rec.date, value: rec.value });
    }

    return NextResponse.json({
      success: true,
      data: {
        indicator: json[1]?.[0]?.indicator?.value ?? indicator,
        series: Object.entries(series).map(([country, data]) => ({
          country,
          data: data.sort((a, b) => a.year.localeCompare(b.year)),
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "World Bank fetch failed" }, { status: 502 });
  }
}
