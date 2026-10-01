/**
 * Insights made from a reader selection: a verbatim quote, its paper and
 * page, and a type (finding, method, ...) judged by Jev. Until the v2 board
 * ships Insight cards, an insight lands on the canvas as a Text node.
 */
import type { PaperSource } from "@/lib/mock";

export const INSIGHT_LABELS: Record<string, string> = {
  finding: "Finding",
  claim: "Claim",
  method: "Method",
  limitation: "Limitation",
  gap: "Gap",
  definition: "Definition",
  quote: "Quote",
};

const JEV_TIMEOUT_MS = 12_000;

/** Jev's insight type for a passage; "quote" when Jev is unavailable. */
export async function classifyInsightType(passage: string, paperTitle: string): Promise<string> {
  try {
    const res = await fetch("/api/jev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "classify-insight", passage, paperTitle }),
      signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    });
    const json = (await res.json()) as { success: boolean; data: { type: string } | null };
    const type = json.success ? json.data?.type : undefined;
    return type && type in INSIGHT_LABELS ? type : "quote";
  } catch {
    return "quote";
  }
}

/** Short in-text style citation: "Grewal et al. (2024), p. 3". */
const SHORT_TITLE_WORDS = 6;

export function shortCitation(paper: Pick<PaperSource, "authors" | "year"> & { title?: string }, page?: number): string {
  const pageSuffix = page ? `, p. ${page}` : "";
  // No author known (e.g. an uploaded PDF without metadata): cite by title.
  if (!paper.authors.trim() && paper.title) {
    const words = paper.title.split(/\s+/);
    const short = words.slice(0, SHORT_TITLE_WORDS).join(" ") + (words.length > SHORT_TITLE_WORDS ? "…" : "");
    return `"${short}" (${paper.year})${pageSuffix}`;
  }
  const first = paper.authors.split(/,| and /)[0]?.trim() || "Unknown";
  const many = /,| and |et al/.test(paper.authors);
  const who = many && !first.includes("et al") ? `${first} et al.` : first;
  return `${who} (${paper.year})${pageSuffix}`;
}

/** The Text node body for an insight: type, verbatim quote, citation, title. */
export function formatInsightNote(type: string, passage: string, paper: PaperSource, page?: number): string {
  const cite = shortCitation(paper, page);
  // Title-based citations already name the paper; don't repeat it.
  const tail = paper.authors.trim() ? `, ${paper.title}` : "";
  return `${INSIGHT_LABELS[type] ?? "Quote"}: "${passage}"\n— ${cite}${tail}`;
}
