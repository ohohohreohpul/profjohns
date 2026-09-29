/**
 * The canonical source type for the whole app. Named `PaperSource` for
 * historical reasons — this is the production model every provider (OpenAlex,
 * arXiv, Semantic Scholar, Wikipedia, web links) maps its results onto, NOT a
 * mock or prototype stand-in. No seed/demo data is injected into real canvases;
 * users add real sources from the providers above.
 */

export interface PaperSource {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  abstract: string;
  /** Optional — not returned by every provider (e.g. arXiv). */
  citations?: number;
  /** Link to the source (e.g. arXiv abstract page). */
  url?: string;
  /** Primary subject category, when available. */
  category?: string;
  /** OpenAlex concept ids + labels — captured at keep-time to train "For You". */
  concepts?: { id: string; name: string }[];
  /** True when a full-text version is freely available. */
  openAccess?: boolean;
  /** Set on web links (Link node) — the date the page was captured. Its
   * presence marks the source as a web reference for citation formatting. */
  accessed?: string;
}
