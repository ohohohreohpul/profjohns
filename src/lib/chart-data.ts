/**
 * Pasted tables -> chart data. Reads spreadsheet copies (tab-separated) and
 * CSV (comma or semicolon, quoted cells), recognises numbers the way people
 * type them (12%, 1,204, 1 204, 3,5), and suggests a chart for the shape.
 */
import { MAX_CHART_COLUMNS, MAX_CHART_ROWS, type ChartType } from "@/lib/board/schema";

export type Cell = string | number | null;

export interface Table {
  readonly columns: string[];
  readonly rows: Cell[][];
}

export type ParseResult =
  | { readonly ok: true; readonly table: Table; readonly truncated: boolean }
  | { readonly ok: false; readonly error: string };

export interface ChartSuggestion {
  readonly type: ChartType;
  readonly xColumn: number;
  readonly yColumns: number[];
}

/** Series colours run out after this many (tokens/data-viz.json caps at 8). */
export const MAX_SERIES = 8;
const TARGET_TICKS = 5;

type Delimiter = "\t" | "," | ";";

function detectDelimiter(firstLine: string): Delimiter | null {
  if (firstLine.includes("\t")) return "\t";
  let commas = 0;
  let semis = 0;
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ",") commas++;
    else if (!quoted && ch === ";") semis++;
  }
  if (semis > commas) return ";";
  return commas > 0 ? "," : null;
}

/** Split text into rows of raw cells; honours "quoted, cells" and "" escapes. */
function splitRows(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === delimiter) {
      row = [...row, cell];
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      rows.push([...row, cell]);
      row = [];
      cell = "";
    } else cell += ch;
  }
  rows.push([...row, cell]);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const THOUSANDS = /^[-+]?\d{1,3}([, ]\d{3})+(\.\d+)?$/;
const DECIMAL_COMMA = /^[-+]?\d+,\d+$/;
const PLAIN_NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

/** A typed cell: number when it reads as one, null when blank, else text. */
export function parseCell(raw: string): Cell {
  const t = raw.trim();
  if (t === "") return null;
  const unit = t.endsWith("%") ? t.slice(0, -1).trim() : t;
  let n: string | null = null;
  if (THOUSANDS.test(unit)) n = unit.replace(/[, ]/g, "");
  else if (DECIMAL_COMMA.test(unit)) n = unit.replace(",", ".");
  else if (PLAIN_NUMBER.test(unit)) n = unit;
  return n === null ? t : Number(n);
}

const isText = (c: Cell): c is string => typeof c === "string";

/** First row is a header if it's all text, or holds text over a numeric column. */
function hasHeader(first: Cell[], rest: Cell[][]): boolean {
  if (first.every((c) => c === null || isText(c))) return true;
  return first.some(
    (c, col) => isText(c) && rest.length > 0 && rest.every((r) => r[col] === null || typeof r[col] === "number"),
  );
}

export function parseTable(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Paste a table first: a header row and at least one row of values." };
  const delimiter = detectDelimiter(trimmed.split(/\r?\n/, 1)[0]);
  if (!delimiter) {
    return { ok: false, error: "That doesn't look like a table. Copy cells from a spreadsheet, or paste CSV." };
  }
  const raw = splitRows(trimmed, delimiter).map((r) => r.map(parseCell));
  const width = Math.max(...raw.map((r) => r.length));
  if (width < 2) return { ok: false, error: "A chart needs at least two columns: labels and values." };

  const header = hasHeader(raw[0], raw.slice(1));
  const body = header ? raw.slice(1) : raw;
  if (body.length === 0) {
    return { ok: false, error: "A chart needs a header row and at least one row of values." };
  }
  const cols = Math.min(width, MAX_CHART_COLUMNS);
  const columns = Array.from({ length: cols }, (_, i) => {
    const name = header ? raw[0][i] : null;
    return name === null || name === undefined ? `Column ${i + 1}` : String(name);
  });
  const rows = body.slice(0, MAX_CHART_ROWS).map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? null));
  return { ok: true, table: { columns, rows }, truncated: width > cols || body.length > MAX_CHART_ROWS };
}

/** Columns whose every filled cell is a number (and at least one is filled). */
export function numericColumns(table: Table): number[] {
  return table.columns
    .map((_, col) => col)
    .filter((col) => {
      const filled = table.rows.map((r) => r[col]).filter((c) => c !== null);
      return filled.length > 0 && filled.every((c) => typeof c === "number");
    });
}

export function suggestChart(table: Table): ChartSuggestion {
  const numeric = numericColumns(table);
  const firstText = table.columns.findIndex((_, col) => !numeric.includes(col));
  const xColumn = firstText === -1 ? 0 : firstText;
  const yColumns = numeric.filter((c) => c !== xColumn).slice(0, MAX_SERIES);
  if (yColumns.length === 0) return { type: "table", xColumn: 0, yColumns: [] };
  if (!numeric.includes(xColumn)) return { type: "bar", xColumn, yColumns };
  const xs = table.rows.map((r) => r[xColumn]).filter((c): c is number => typeof c === "number");
  const ascending = xs.every((x, i) => i === 0 || x > xs[i - 1]);
  return { type: ascending ? "line" : "scatter", xColumn, yColumns };
}

/** The table as tab-separated text (to edit it again as a paste). */
export function toTsv(table: Table): string {
  const cell = (c: Cell) => (c === null ? "" : String(c).replace(/[\t\r\n]+/g, " "));
  return [table.columns, ...table.rows].map((r) => r.map(cell).join("\t")).join("\n");
}

/**
 * Whether pasted text is clearly a table (so pasting it on the board makes a
 * chart). Strict on purpose: prose with commas must stay prose.
 */
export function looksTabular(text: string): boolean {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return false;
  const delimiter = detectDelimiter(lines[0]);
  if (!delimiter) return false;
  const parsed = parseTable(text);
  if (!parsed.ok) return false;
  if (delimiter === "\t") return true;
  const widths = new Set(splitRows(text.trim(), delimiter).map((r) => r.length));
  return widths.size === 1 && numericColumns(parsed.table).length > 0;
}

/** Round axis ticks (steps of 1, 2 or 5 x 10^k) covering [min, max]. */
export function niceTicks(min: number, max: number): number[] {
  const lo = min === max ? min - 1 : Math.min(min, max);
  const hi = min === max ? max + 1 : Math.max(min, max);
  const raw = (hi - lo) / TARGET_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const count = Math.round((end - start) / step);
  // Round away floating-point dust (0.30000000000000004).
  return Array.from({ length: count + 1 }, (_, i) => Number((start + i * step).toPrecision(12)));
}
