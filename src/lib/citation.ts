import type { PaperSource } from "./mock";

/**
 * Citation styles the Writing surface can format references and in-text marks
 * in. Formatting is a pragmatic approximation — enough to adhere to the shape
 * each standard expects from the data we have (a display author string,
 * title, venue, year).
 */
export type CitationStyle = "apa" | "ieee" | "nature" | "mla";

export const STYLE_LABEL: Record<CitationStyle, string> = {
  apa: "APA",
  ieee: "IEEE",
  nature: "Nature",
  mla: "MLA",
};

export const STYLE_ORDER: CitationStyle[] = ["apa", "ieee", "nature", "mla"];

export const DEFAULT_STYLE: CitationStyle = "apa";

/** Full bibliography entry. `index` is 1-based citation order. */
export function formatReference(
  paper: PaperSource,
  style: CitationStyle,
  index: number,
): string {
  const { authors, title, venue, year } = paper;
  // Web sources (Link node) cite as web references — site, title, URL, and the
  // date the page was accessed — rather than a journal/venue entry.
  if (paper.accessed && paper.url) {
    const site = authors || venue;
    switch (style) {
      case "ieee":
        return `[${index}] ${site}, "${title}." ${paper.url} (accessed ${paper.accessed}).`;
      case "nature":
        return `${index}. ${site}. ${title}. ${paper.url} (${year}).`;
      case "mla":
        return `${site}. "${title}." ${venue}, ${year}, ${paper.url}. Accessed ${paper.accessed}.`;
      case "apa":
      default:
        return `${site}. (${year}). ${title}. ${venue}. Retrieved ${paper.accessed}, from ${paper.url}`;
    }
  }
  switch (style) {
    case "ieee":
      return `[${index}] ${authors}, "${title}," ${venue}, ${year}.`;
    case "nature":
      return `${index}. ${authors} ${title}. ${venue} (${year}).`;
    case "mla":
      return `${authors}. "${title}." ${venue}, ${year}.`;
    case "apa":
    default:
      return `${authors} (${year}). ${title}. ${venue}.`;
  }
}

/** In-text citation marker for inserting into the draft. */
export function formatInText(
  paper: PaperSource,
  style: CitationStyle,
  index: number,
): string {
  switch (style) {
    case "ieee":
    case "nature":
      return `[${index}]`;
    case "mla":
      return `(${paper.authors})`;
    case "apa":
    default:
      return `(${paper.authors}, ${paper.year})`;
  }
}
