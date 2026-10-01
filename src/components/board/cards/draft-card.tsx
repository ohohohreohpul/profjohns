"use client";

import * as React from "react";
import { ArrowsOutSimple } from "@phosphor-icons/react";
import type { CardDataFor } from "@/lib/board/schema";
import { extractText } from "@/lib/document";

interface DraftCardBodyProps {
  readonly data: CardDataFor["draft"];
  readonly onOpen: () => void;
}

const OUTLINE_PREVIEW = 6;

/** The paper: title, length, outline (from themes), and the way into the editor. */
export function DraftCardBody({ data, onOpen }: DraftCardBodyProps) {
  const words = extractText(data.content as never).split(/\s+/).filter(Boolean).length;
  return (
    <>
      <h3 className="font-serif text-base font-semibold leading-snug text-ink">{data.title || "Untitled draft"}</h3>
      <p className="mt-1 text-xs tabular-nums text-grey-600">{words === 0 ? "Empty draft" : `${words} words`}</p>
      {data.outline.length > 0 && (
        <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs text-grey-700">
          {data.outline.slice(0, OUTLINE_PREVIEW).map((section, i) => (
            <li key={i} className="truncate">
              {section}
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-grey-800"
      >
        <ArrowsOutSimple className="size-3.5" />
        Open editor
      </button>
    </>
  );
}
