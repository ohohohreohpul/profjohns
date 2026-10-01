"use client";

import * as React from "react";
import { BookOpen, Check, FilePdf } from "@phosphor-icons/react";
import type { CardDataFor } from "@/lib/board/schema";
import { pdfLinkFor } from "@/lib/pdf-url";

interface PaperCardBodyProps {
  readonly data: CardDataFor["paper"];
  readonly onRead: () => void;
  readonly onKeep: () => void;
}

/** A paper: title, who/when, relevance, and Read / Keep. */
export function PaperCardBody({ data, onRead, onKeep }: PaperCardBodyProps) {
  const { paper, status, score, why } = data;
  const meta = [paper.authors, paper.year].filter(Boolean).join(" · ");
  const hasPdf = !!pdfLinkFor(paper);
  return (
    <>
      <h3 className="line-clamp-3 text-sm font-medium leading-snug text-ink">{paper.title}</h3>
      {meta && <p className="mt-1 truncate text-xs text-grey-600">{meta}</p>}
      {why && <p className="mt-1.5 line-clamp-2 text-xs italic leading-relaxed text-grey-600">{why}</p>}
      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRead}
          className="flex items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-xs font-medium text-ink transition-colors hover:bg-grey-100"
        >
          {hasPdf ? <FilePdf className="size-3.5" /> : <BookOpen className="size-3.5" />}
          Read
        </button>
        {status === "new" && (
          <button
            type="button"
            onClick={onKeep}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-grey-700 transition-colors hover:bg-grey-100 hover:text-ink"
          >
            <Check className="size-3.5" />
            Keep
          </button>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-xs tabular-nums text-grey-600">
          {status === "new" && <span className="rounded bg-grey-100 px-1.5 py-0.5 font-medium">New</span>}
          {score !== undefined && <span title="Relevance to your question">{score}</span>}
        </span>
      </div>
    </>
  );
}
