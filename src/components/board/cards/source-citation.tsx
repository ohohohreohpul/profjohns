"use client";

import type { CardDataFor } from "@/lib/board/schema";
import { shortCitation } from "@/lib/insight";

interface SourceCitationProps {
  readonly source: NonNullable<CardDataFor["figure"]["source"]>;
  readonly page?: number;
  /** Open the paper in the Reader (absent when it isn't on the board). */
  readonly onOpen?: () => void;
}

/** "Author et al. (2021), p. 4": where a figure or chart comes from. */
export function SourceCitation({ source, page, onOpen }: SourceCitationProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      title={source.title}
      className="mt-1 block max-w-full truncate text-left text-xs text-grey-600 underline-offset-2 hover:text-ink hover:underline disabled:no-underline"
    >
      {shortCitation({ authors: source.authors ?? "", year: source.year ?? 0, title: source.title }, page)}
    </button>
  );
}
