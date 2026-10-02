"use client";

import * as React from "react";
import { CHART_TYPES, type CardDataFor, type ChartType } from "@/lib/board/schema";
import { toTsv, type ChartSuggestion, type Table } from "@/lib/chart-data";
import { cn } from "@/lib/utils";
import { ChartComposer } from "./chart-composer";
import { ChartLegend, ChartTable, ChartView, describeChart } from "./chart-view";
import { SourceCitation } from "./source-citation";
import { TextCardBody } from "./text-card";

type ChartData = CardDataFor["chart"];

const TYPE_LABELS: Record<ChartType, string> = { bar: "Bar", line: "Line", scatter: "Scatter", table: "Table" };

/** New chart data from a pasted table (title/caption/source kept when editing). */
export function chartFromTable(table: Table, suggestion: ChartSuggestion, previous?: ChartData): ChartData {
  // Keep the chosen chart type across a data edit when the new data can draw it.
  const keepType = previous && previous.type !== "table" && suggestion.yColumns.length > 0;
  return {
    ...(previous ?? { title: "", caption: "" }),
    columns: table.columns,
    rows: table.rows,
    xColumn: suggestion.xColumn,
    yColumns: suggestion.yColumns,
    type: keepType ? previous.type : suggestion.type,
  };
}

interface ChartCardBodyProps {
  readonly data: ChartData;
  readonly onChange: (data: ChartData) => void;
  /** Data editor open (from the card menu). */
  readonly editing: boolean;
  readonly onEditingChange: (editing: boolean) => void;
  readonly onOpenSource?: () => void;
}

/** A chart: title, type switch, the SVG (or table), its data, caption, source. */
export function ChartCardBody({ data, onChange, editing, onEditingChange, onOpenSource }: ChartCardBodyProps) {
  const [showData, setShowData] = React.useState(false);
  const canPlot = data.yColumns.length > 0;
  const tableId = React.useId();

  if (editing) {
    return (
      <ChartComposer
        initial={toTsv(data)}
        submitLabel="Save data"
        onCancel={() => onEditingChange(false)}
        onSubmit={(table, suggestion) => {
          onChange(chartFromTable(table, suggestion, data));
          onEditingChange(false);
        }}
      />
    );
  }

  return (
    <figure>
      <TextCardBody ariaLabel="Chart title" value={data.title} placeholder="Name this chart…" onSave={(title) => onChange({ ...data, title })} />

      <div role="group" aria-label="Chart type" className="mt-1.5 flex gap-0.5 rounded-md bg-grey-100 p-0.5">
        {CHART_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={data.type === t}
            disabled={t !== "table" && !canPlot}
            onClick={() => onChange({ ...data, type: t })}
            className={cn(
              "flex-1 rounded px-1.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              data.type === t ? "bg-paper text-ink shadow-sm" : "text-grey-600 hover:text-ink",
            )}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {data.type === "table" || !canPlot ? (
          <ChartTable data={data} caption={data.title || "Chart data"} />
        ) : (
          <>
            <ChartView data={data} />
            <ChartLegend data={data} />
            <button
              type="button"
              aria-expanded={showData}
              aria-controls={tableId}
              onClick={() => setShowData((v) => !v)}
              className="mt-1.5 text-xs font-medium text-grey-600 underline-offset-2 hover:text-ink hover:underline"
            >
              {showData ? "Hide data" : "Show data"}
            </button>
            <div id={tableId} hidden={!showData} className="mt-1.5">
              {showData && <ChartTable data={data} caption={describeChart(data)} />}
            </div>
          </>
        )}
      </div>

      <figcaption className="mt-2">
        <TextCardBody ariaLabel="Chart caption" value={data.caption} placeholder="Add a caption…" onSave={(caption) => onChange({ ...data, caption })} />
        {data.source && <SourceCitation source={data.source} page={data.page} onOpen={onOpenSource} />}
      </figcaption>
    </figure>
  );
}
