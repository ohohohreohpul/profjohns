/**
 * OpenAlex treats `?` and `*` in `search=` as wildcards and answers 400 when
 * they appear in plain text, so a natural research question ("...tests?")
 * failed outright. Every other character was probed and is accepted as-is.
 */
const OPENALEX_WILDCARDS = /[?*]/g;

/** Make free text safe for OpenAlex's `search=` parameter. */
export function toOpenAlexSearch(text: string): string {
  return text.replace(OPENALEX_WILDCARDS, " ").replace(/\s+/g, " ").trim();
}

/** `,` separates filters and `|` separates OR-values in OpenAlex filters. */
const FILTER_SEPARATORS = /[,|]/g;

/**
 * The precise search: words must appear in a work's title or abstract.
 * Plain `search=` also matches full text and leans on citation counts, which
 * lets famous broad reviews crowd out specific papers. Measured on a PhD
 * question's real angles (scored by Jev): 3 results at partially-relevant or
 * better vs 1 for plain search. Returns null when nothing searchable remains.
 */
export function toTitleAbstractFilter(text: string): string | null {
  const cleaned = toOpenAlexSearch(text.replace(FILTER_SEPARATORS, " "));
  return cleaned ? `title_and_abstract.search:${cleaned}` : null;
}

/** Concatenate result lists, first occurrence wins, capped at `limit`. */
export function mergeUnique<T extends { id: string }>(
  first: readonly T[],
  second: readonly T[],
  limit: number,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...first, ...second]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
