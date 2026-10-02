"use client";

import * as React from "react";
import type { Card, CardDataFor } from "@/lib/board/schema";
import { cn } from "@/lib/utils";
/** dataTransfer type of a dragged insight card (a theme accepts the drop). */
const CARD_DND_MIME = "application/x-profjohns-card";
import { TextCardBody } from "./text-card";

const PREVIEW_QUOTES = 3;

interface ThemeCardBodyProps {
  readonly data: CardDataFor["theme"];
  /** Insight cards assigned to this theme. */
  readonly insights: readonly Card<"insight">[];
  readonly onRename: (name: string) => void;
  /** An insight card was dropped onto this theme. */
  readonly onDropInsight: (cardId: string) => void;
  /** Shown while the theme has no insights (how to add them here). */
  readonly emptyHint?: string;
}

/**
 * A theme: an argument the paper will make, with the evidence behind it.
 * Drop an insight onto it to add that insight as evidence.
 */
export function ThemeCardBody({ data, insights, onRename, onDropInsight, emptyHint = "Drop insights here, or use an insight's menu." }: ThemeCardBodyProps) {
  const [over, setOver] = React.useState(false);
  const papers = new Set(insights.map((i) => i.data.source?.paperId).filter(Boolean));

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(CARD_DND_MIME)) return;
        e.preventDefault();
        e.stopPropagation(); // this theme, not the wall, takes the drop
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(CARD_DND_MIME);
        setOver(false);
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        onDropInsight(id);
      }}
      className={cn("-m-1 rounded-md p-1 transition-colors", over && "bg-grey-100 ring-2 ring-highlight")}
    >
      <TextCardBody prominent ariaLabel="Theme name" value={data.name} placeholder="Name this theme…" onSave={onRename} />
      <p className="mt-1 text-xs tabular-nums text-grey-600">
        {insights.length === 0
          ? emptyHint
          : `${insights.length} insight${insights.length === 1 ? "" : "s"} · ${papers.size} paper${papers.size === 1 ? "" : "s"}`}
      </p>
      {insights.length > 0 && (
        <ul className="mt-2 space-y-1 border-l-2 border-grey-200 pl-2">
          {insights.slice(0, PREVIEW_QUOTES).map((i) => (
            <li key={i.id} className="line-clamp-2 font-serif text-xs leading-relaxed text-grey-700">
              {i.data.quote?.text ?? i.data.statement}
            </li>
          ))}
          {insights.length > PREVIEW_QUOTES && (
            <li className="text-xs text-grey-500">and {insights.length - PREVIEW_QUOTES} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
