"use client";

import * as React from "react";
import type { CardDataFor } from "@/lib/board/schema";
import { shortCitation } from "@/lib/insight";

interface InsightCardBodyProps {
  readonly data: CardDataFor["insight"];
  readonly onOpenSource?: () => void;
}

/** An insight: the statement (or verbatim quote) and where it comes from. */
export function InsightCardBody({ data, onOpenSource }: InsightCardBodyProps) {
  const { statement, quote, source } = data;
  return (
    <>
      <p className="font-serif text-sm leading-relaxed text-ink">
        {quote ? <>&ldquo;{quote.text}&rdquo;</> : statement}
      </p>
      {quote && statement !== quote.text && <p className="mt-1.5 text-xs leading-relaxed text-grey-700">{statement}</p>}
      {source && (
        <button
          type="button"
          onClick={onOpenSource}
          disabled={!onOpenSource}
          className="mt-2 block max-w-full truncate text-left text-xs text-grey-600 underline-offset-2 hover:text-ink hover:underline disabled:no-underline"
          title={source.title}
        >
          {shortCitation({ authors: source.authors ?? "", year: source.year ?? 0, title: source.title }, quote?.page)}
        </button>
      )}
    </>
  );
}
