"use client";

import * as React from "react";
import { parseTable, suggestChart, type ChartSuggestion, type Table } from "@/lib/chart-data";

const TYPE_NAMES: Record<ChartSuggestion["type"], string> = {
  bar: "bar chart",
  line: "line chart",
  scatter: "scatter plot",
  table: "table",
};

interface ChartComposerProps {
  /** Existing data as TSV when editing; empty for a new chart. */
  readonly initial?: string;
  readonly submitLabel: string;
  readonly onSubmit: (table: Table, suggestion: ChartSuggestion) => void;
  readonly onCancel: () => void;
}

/** Paste a table (spreadsheet cells or CSV); preview what it becomes; confirm. */
export function ChartComposer({ initial = "", submitLabel, onSubmit, onCancel }: ChartComposerProps) {
  const [text, setText] = React.useState(initial);
  const id = React.useId();
  const parsed = React.useMemo(() => (text.trim() ? parseTable(text) : null), [text]);
  const suggestion = parsed?.ok ? suggestChart(parsed.table) : null;

  function submit() {
    if (parsed?.ok && suggestion) onSubmit(parsed.table, suggestion);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="rounded-lg border border-grey-300 bg-paper p-2.5"
    >
      <label htmlFor={id} className="text-xs font-medium text-ink">
        Chart data
      </label>
      <textarea
        id={id}
        autoFocus
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-describedby={`${id}-hint ${id}-status`}
        placeholder={"Model\tAccuracy\nViT-B\t81.8\nMLP-Mixer\t76.4"}
        className="mt-1 block w-full resize-y rounded-md border border-grey-300 bg-paper px-2 py-1.5 font-mono text-xs leading-relaxed text-ink outline-none placeholder:text-grey-500 focus-visible:border-grey-600"
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-grey-600">
        Paste cells from a spreadsheet, or CSV. The first row names the columns.
      </p>
      <p id={`${id}-status`} role="status" className="mt-1 min-h-4 text-xs">
        {parsed && !parsed.ok && <span className="text-feedback-danger">{parsed.error}</span>}
        {parsed?.ok && suggestion && (
          <span className="text-ink">
            {parsed.table.columns.length} columns, {parsed.table.rows.length} rows: makes a {TYPE_NAMES[suggestion.type]}.
            {parsed.truncated && " Only the first 200 rows and 12 columns are kept."}
          </span>
        )}
      </p>
      <div className="mt-2 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-grey-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!parsed?.ok}
          className="rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-grey-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
