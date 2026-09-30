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
