"use client";

import * as React from "react";
import type { CardDataFor } from "@/lib/board/schema";
import { niceTicks, type Cell } from "@/lib/chart-data";

type ChartData = CardDataFor["chart"];

/** Drawing area in viewBox units; the card is ~240 CSS px wide, so 1:1. */
export const CHART_W = 240;
export const CHART_H = 160;
const W = CHART_W;
const H = CHART_H;
const PAD = { top: 8, right: 8, bottom: 26, left: 34 } as const;
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const MAX_X_LABELS = 6;
const LABEL_CHARS = 9;
/** Above this many points, lines drop their markers (they'd merge). */
const MARKER_LIMIT = 40;
const BAR_GAP = 0.2;

export const seriesColor = (i: number) => `var(--color-viz-${(i % 8) + 1})`;
const SHAPES = ["circle", "square", "triangle", "diamond"] as const;
type Shape = (typeof SHAPES)[number];
export const seriesShape = (i: number): Shape => SHAPES[i % SHAPES.length];

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 });
export const formatNumber = (n: number) => (Math.abs(n) >= 10_000 ? compact.format(n) : String(Number(n.toPrecision(6))));
const formatCell = (c: Cell) => (c === null ? "" : typeof c === "number" ? formatNumber(c) : c);
const shorten = (s: string) => (s.length > LABEL_CHARS ? `${s.slice(0, LABEL_CHARS - 1)}…` : s);

/** A marker of `shape` centred on (x, y): series differ by shape, not just hue. */
export function Marker({ shape, x, y, r = 3, ...rest }: { shape: Shape; x: number; y: number; r?: number } & React.SVGProps<SVGElement>) {
  const props = rest as React.SVGProps<SVGPathElement>;
  switch (shape) {
    case "circle":
      return <circle cx={x} cy={y} r={r} {...(rest as React.SVGProps<SVGCircleElement>)} />;
    case "square":
      return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} {...(rest as React.SVGProps<SVGRectElement>)} />;
    case "triangle":
      return <path d={`M${x},${y - r * 1.2}L${x + r * 1.1},${y + r * 0.8}L${x - r * 1.1},${y + r * 0.8}Z`} {...props} />;
    case "diamond":
      return <path d={`M${x},${y - r * 1.3}L${x + r * 1.3},${y}L${x},${y + r * 1.3}L${x - r * 1.3},${y}Z`} {...props} />;
  }
}

function numbersIn(data: ChartData): number[] {
  return data.rows.flatMap((r) => data.yColumns.map((c) => r[c])).filter((v): v is number => typeof v === "number");
}

/** One-sentence description for screen readers. */
export function describeChart(data: ChartData): string {
  const series = data.yColumns.map((c) => data.columns[c]).join(", ");
  const kind = data.type === "bar" ? "Bar chart" : data.type === "line" ? "Line chart" : "Scatter plot";
  const values = numbersIn(data);
  const range = values.length ? `, values from ${formatNumber(Math.min(...values))} to ${formatNumber(Math.max(...values))}` : "";
  return `${kind} of ${series} by ${data.columns[data.xColumn]}, ${data.rows.length} rows${range}.`;
}

/** The chart itself, as plain SVG. `type: "table"` is drawn by ChartTable. */
export function ChartView({ data, print }: { readonly data: ChartData; readonly print?: { x: number; y: number } }) {
  const values = numbersIn(data);
  if (values.length === 0) {
    return <p className="rounded-md border border-dashed border-grey-300 p-3 text-xs text-grey-600">No numbers to plot. Switch to Table, or edit the data to add a column of values.</p>;
  }
  const isBar = data.type === "bar";
  // Bars grow from zero, so zero is always on the axis.
  const yTicks = niceTicks(isBar ? Math.min(0, ...values) : Math.min(...values), isBar ? Math.max(0, ...values) : Math.max(...values));
  const y0 = yTicks[0];
  const y1 = yTicks[yTicks.length - 1];
  const yAt = (v: number) => PAD.top + PLOT_H - ((v - y0) / (y1 - y0)) * PLOT_H;

  const xValues = data.rows.map((r) => r[data.xColumn]);
  const numericX = !isBar && xValues.every((v) => typeof v === "number");
  const xTicks = numericX ? niceTicks(Math.min(...(xValues as number[])), Math.max(...(xValues as number[]))) : [];
  const n = data.rows.length;
  const band = PLOT_W / Math.max(1, n);
  const xAt = (row: number) =>
    numericX
      ? PAD.left + (((xValues[row] as number) - xTicks[0]) / (xTicks[xTicks.length - 1] - xTicks[0])) * PLOT_W
      : PAD.left + band * (row + 0.5);
  const labelEvery = Math.ceil(n / MAX_X_LABELS);
  const showMarkers = data.type === "scatter" || n <= MARKER_LIMIT;
  const tip = (row: number, col: number) =>
    `${formatCell(data.rows[row][data.xColumn])}, ${data.columns[col]}: ${formatCell(data.rows[row][col])}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={describeChart(data)}
      // Print: a fixed-size box inside a larger export SVG (chart-print.tsx).
      {...(print ? { x: print.x, y: print.y, width: W, height: H } : { className: "block h-auto w-full overflow-visible" })}
    >
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--color-grey-200)" strokeWidth={t === 0 ? 1.25 : 0.75} />
          <text x={PAD.left - 4} y={yAt(t)} dy="0.32em" textAnchor="end" fontSize={9} fill="var(--color-grey-600)" className="tabular-nums">
            {formatNumber(t)}
          </text>
        </g>
      ))}

      {numericX
        ? xTicks.map((t) => {
            const x = PAD.left + ((t - xTicks[0]) / (xTicks[xTicks.length - 1] - xTicks[0])) * PLOT_W;
            return (
              <text key={`x${t}`} x={x} y={H - PAD.bottom + 12} textAnchor="middle" fontSize={9} fill="var(--color-grey-600)" className="tabular-nums">
                {formatNumber(t)}
              </text>
            );
          })
        : data.rows.map((r, i) =>
            i % labelEvery === 0 ? (
              <text key={`x${i}`} x={xAt(i)} y={H - PAD.bottom + 12} textAnchor="middle" fontSize={9} fill="var(--color-grey-600)">
                {shorten(formatCell(r[data.xColumn]))}
              </text>
            ) : null,
          )}
      <text x={PAD.left + PLOT_W / 2} y={H - 2} textAnchor="middle" fontSize={9} fontWeight={500} fill="var(--color-grey-600)">
        {data.columns[data.xColumn]}
      </text>

      {isBar &&
        data.rows.map((r, row) => {
          const inner = (band * (1 - BAR_GAP)) / data.yColumns.length;
          const left = PAD.left + band * row + (band * BAR_GAP) / 2;
          return data.yColumns.map((col, s) => {
            const v = r[col];
            if (typeof v !== "number") return null;
            const top = Math.min(yAt(v), yAt(0));
            return (
              <rect key={`${row}-${col}`} x={left + inner * s} y={top} width={Math.max(1, inner - 0.5)} height={Math.max(0.5, Math.abs(yAt(v) - yAt(0)))} fill={seriesColor(s)} rx={1}>
                <title>{tip(row, col)}</title>
              </rect>
            );
          });
        })}

      {!isBar &&
        data.yColumns.map((col, s) => {
          const points = data.rows.map((r, row) => (typeof r[col] === "number" ? { row, x: xAt(row), y: yAt(r[col] as number) } : null));
          // A blank cell breaks the line rather than bridging the gap.
          const path = points.reduce((d, p, i) => (p ? `${d}${i > 0 && points[i - 1] ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}` : d), "");
          return (
            <g key={col} fill={seriesColor(s)} stroke={seriesColor(s)}>
              {data.type === "line" && <path d={path} fill="none" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
              {showMarkers &&
                points.map((p) =>
                  p ? (
                    <Marker key={p.row} shape={seriesShape(s)} x={p.x} y={p.y} r={data.type === "scatter" ? 3 : 2.5} stroke="var(--color-paper)" strokeWidth={0.75}>
                      <title>{tip(p.row, col)}</title>
                    </Marker>
                  ) : null,
                )}
            </g>
          );
        })}
    </svg>
  );
}

/** Which colour and marker is which series (colour is never the only cue). */
export function ChartLegend({ data }: { readonly data: ChartData }) {
  return (
    <ul aria-label="Series" className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
      {data.yColumns.map((col, s) => (
        <li key={col} className="flex items-center gap-1 text-xs text-grey-700">
          <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0" fill={seriesColor(s)}>
            <Marker shape={data.type === "bar" ? "square" : seriesShape(s)} x={5} y={5} r={3.5} />
          </svg>
          {data.columns[col]}
        </li>
      ))}
    </ul>
  );
}

/** The data as a real table: the chart's accessible equivalent, and the "table" type. */
export function ChartTable({ data, caption }: { readonly data: ChartData; readonly caption: string }) {
  return (
    <div className="max-h-64 overflow-auto rounded-md border border-grey-200">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-grey-50">
          <tr>
            {data.columns.map((c, i) => (
              <th key={i} scope="col" className="border-b border-grey-200 px-2 py-1 text-left font-medium text-ink">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i} className="even:bg-grey-50">
              {r.map((c, j) => (
                <td key={j} className={typeof c === "number" ? "px-2 py-1 text-right tabular-nums text-ink" : "px-2 py-1 text-ink"}>
                  {formatCell(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
