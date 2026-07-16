/**
 * Mock research data for the prototype. Stands in for results that would
 * eventually come from arXiv / Semantic Scholar APIs and a PDF extractor.
 */

export interface PaperSource {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  abstract: string;
  /** Digital Object Identifier — used for citation verification. */
  doi?: string;
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

export interface ReadingAnchor {
  id: string;
  paperId: string;
  page: number;
  reason: string;
}

const ANCHOR_PAGES = [3, 5, 8];
const ANCHOR_REASONS = [
  "Core method definition — start here.",
  "Ablation relevant to your research direction.",
  "Counter-argument worth citing in your review.",
];

/**
 * Derive reading anchors from the actual source set so the agent's
 * "where to read first" reflects the papers currently on the canvas.
 */
export function buildAnchors(papers: PaperSource[]): ReadingAnchor[] {
  return papers.slice(0, ANCHOR_PAGES.length).map((paper, i) => ({
    id: `anchor-${paper.id}`,
    paperId: paper.id,
    page: ANCHOR_PAGES[i],
    reason: ANCHOR_REASONS[i],
  }));
}
