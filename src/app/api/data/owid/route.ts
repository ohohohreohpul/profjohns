import { NextRequest, NextResponse } from "next/server";

/**
 * Our World in Data data provider — fetches open research datasets.
 * Uses the OWID GitHub catalog for CSV data.
 * https://github.com/owid/owid-dataset-templates
 */

export async function GET(request: NextRequest) {
  const dataset = request.nextUrl.searchParams.get("dataset");

  try {
    if (!dataset) {
      // List available datasets
      return NextResponse.json({
        success: true,
        data: [
          { id: "covid-19", name: "COVID-19 Data", url: "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data.csv" },
          { id: "co2-emissions", name: "CO2 Emissions", url: "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv" },
          { id: "energy", name: "Energy Data", url: "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv" },
          { id: "population", name: "World Population", url: "https://raw.githubusercontent.com/owid/owid-datasets/main/datasets/Population%20(WPP,%202022)/population.csv" },
        ],
      });
    }

    // Map dataset id to CSV URL
    const datasetMap: Record<string, string> = {
      "covid-19": "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data.csv",
      "co2-emissions": "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv",
      "energy": "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv",
    };

    const csvUrl = datasetMap[dataset];
    if (!csvUrl) {
      return NextResponse.json({ success: false, error: `Unknown dataset: ${dataset}` }, { status: 400 });
    }

    const res = await fetch(csvUrl);
    if (!res.ok) {
      return NextResponse.json({ success: false, error: `OWID returned ${res.status}` }, { status: 502 });
    }

    const csv = await res.text();
    // Parse CSV header + first 1000 rows to keep response small
    const lines = csv.split("\n");
    const header = lines[0];
    const rows = lines.slice(1, 1001);
    const limitedCsv = [header, ...rows].join("\n");

    return NextResponse.json({
      success: true,
      data: {
        dataset,
        csv: limitedCsv,
        totalRows: lines.length - 1,
        returnedRows: rows.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "OWID fetch failed" }, { status: 502 });
  }
}
