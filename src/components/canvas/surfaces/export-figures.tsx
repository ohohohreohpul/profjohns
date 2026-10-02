"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { JSONContent } from "@tiptap/core";
import type { CardDataFor } from "@/lib/board/schema";
import { listFigures, type DraftFigure } from "@/lib/draft-figures";
import { figureUrl } from "@/lib/figure-storage";
import { fitWithin, lightThemeVars, resolveCssVars } from "@/lib/print-colors";
import type { EmbeddedImage } from "@/lib/export";
import { CHART_H, CHART_W, ChartView, Marker, describeChart, seriesColor, seriesShape } from "@/components/board/cards/chart-view";
import { figureAlt } from "@/components/board/cards/figure-card";

/** Rasterise exported charts this many times their drawn size (print-sharp). */
const RASTER_SCALE = 3;
/** Word page text width at 96 dpi (6.5 in minus a little air). */
const PAGE_WIDTH_PX = 576;
const LEGEND_ROW = 14;
const LEGEND_PAD = 6;
/** Rough glyph width at 9px for laying out legend items. */
const LEGEND_CHAR_PX = 5;
const LEGEND_GAP = 14;
/** Air around the exported chart so edge markers and labels aren't clipped. */
const MARGIN = 8;
/** Legend starts under the plot area, not under the y-axis labels. */
const LEGEND_INDENT = 30;

type ChartData = CardDataFor["chart"];

/** Lay legend items left to right, wrapping rows within the chart width. */
function legendLayout(data: ChartData): { items: { col: number; s: number; x: number; y: number }[]; height: number } {
  let x = 0;
  let row = 0;
  const items = data.yColumns.map((col, s) => {
    const width = 12 + data.columns[col].length * LEGEND_CHAR_PX;
    if (x > 0 && LEGEND_INDENT + x + width > CHART_W) {
      x = 0;
      row++;
    }
    const item = { col, s, x: MARGIN + LEGEND_INDENT + x, y: MARGIN + CHART_H + LEGEND_PAD + row * LEGEND_ROW };
    x += width + LEGEND_GAP;
    return item;
  });
  return { items, height: data.yColumns.length ? LEGEND_PAD + (row + 1) * LEGEND_ROW : 0 };
}

const printSize = (data: ChartData) => ({
  width: CHART_W + 2 * MARGIN,
  height: CHART_H + legendLayout(data).height + 2 * MARGIN,
});

/** The chart plus its legend as one standalone SVG (legend is HTML in the app). */
function PrintChart({ data }: { readonly data: ChartData }) {
  const { width, height } = printSize(data);
  const legend = legendLayout(data);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fontFamily="var(--font-sans)"
    >
      <rect width="100%" height="100%" fill="var(--color-paper)" />
      <ChartView data={data} print={{ x: MARGIN, y: MARGIN }} />
      {legend.items.map(({ col, s, x, y }) => (
        <g key={col}>
          <Marker shape={data.type === "bar" ? "square" : seriesShape(s)} x={x + 4} y={y + 4} r={3} fill={seriesColor(s)} />
          <text x={x + 11} y={y + 4} dy="0.32em" fontSize={9} fill="var(--color-grey-700)">
            {data.columns[col]}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Static SVG markup for a chart, in the light theme's colours. */
function chartSvg(data: ChartData, vars: ReadonlyMap<string, string>): { svg: string; width: number; height: number } {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(<PrintChart data={data} />));
  const markup = host.innerHTML;
  root.unmount();
  return { svg: resolveCssVars(markup, vars), ...printSize(data) };
}

/** Light-theme paper colour (exports print on white whatever the app theme). */
const paperOf = (vars: ReadonlyMap<string, string>) => vars.get("--color-paper") ?? "white";

async function toPng(source: CanvasImageSource, width: number, height: number, paper: string): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = paper; // a transparent PNG prints black in some viewers
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Couldn't encode the figure");
  return new Uint8Array(await blob.arrayBuffer());
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img;
}

async function chartImage(data: ChartData, vars: ReadonlyMap<string, string>): Promise<EmbeddedImage> {
  const { svg, width, height } = chartSvg(data, vars);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    const bytes = await toPng(img, width * RASTER_SCALE, height * RASTER_SCALE, paperOf(vars));
    return { data: bytes, type: "png", ...fitWithin(width * 2, height * 2, PAGE_WIDTH_PX), alt: describeChart(data) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pictureImage(data: CardDataFor["figure"], vars: ReadonlyMap<string, string>): Promise<EmbeddedImage> {
  const url = await figureUrl(data.image);
  const img = await loadImage(url);
  const width = data.image.width ?? img.naturalWidth;
  const height = data.image.height ?? img.naturalHeight;
  // Re-encode via canvas: one format (PNG) whatever was uploaded.
  const bytes = await toPng(img, img.naturalWidth, img.naturalHeight, paperOf(vars));
  return { data: bytes, type: "png", ...fitWithin(width, height, PAGE_WIDTH_PX), alt: figureAlt(data) };
}

function imageFor(f: DraftFigure, vars: ReadonlyMap<string, string>): Promise<EmbeddedImage> {
  return f.kind === "chart" ? chartImage(f.data as ChartData, vars) : pictureImage(f.data as CardDataFor["figure"], vars);
}

/**
 * Images for every figure in the draft, keyed by figure number. A figure
 * that can't be loaded is skipped (its caption still exports) and counted.
 */
export async function prepareFigureImages(content: JSONContent): Promise<{ images: Map<number, EmbeddedImage>; failed: number }> {
  const figures = listFigures(content);
  const vars = lightThemeVars();
  const results = await Promise.allSettled(figures.map((f) => imageFor(f, vars)));
  const images = new Map<number, EmbeddedImage>();
  results.forEach((r, i) => {
    if (r.status === "fulfilled") images.set(figures[i].number, r.value);
  });
  results.forEach((r, i) => {
    // The user is told how many were skipped; keep the reason for debugging.
    if (r.status === "rejected") console.error(`Export: figure ${figures[i].number} (${figures[i].kind}) not embedded`, r.reason);
  });
  return { images, failed: results.filter((r) => r.status === "rejected").length };
}
