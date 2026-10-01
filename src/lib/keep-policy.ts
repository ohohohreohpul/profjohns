/**
 * Which screened sources to keep. Scores are 0-100 relevance (Jev's 0-4
 * relevance levels mapped onto 0-100, or the LLM fallback's own scale).
 *
 * Narrow research questions often get no strong match from the indexes: on
 * the live site a PhD question's best result scored 53 of 100, so a plain
 * threshold kept nothing and every downstream node (Synthesize, Draft) had
 * nothing to work with. When that happens, keep the closest few that are at
 * least partly on topic, and tell the caller it's a fallback so the UI can
 * say so honestly.
 */

/** "Relevant" or better: kept without caveat. */
export const KEEP_THRESHOLD = 70;
/** Below this a paper is at best loosely related; never kept as a fallback. */
export const FALLBACK_FLOOR = 35;
/** How many closest papers to keep when nothing clears KEEP_THRESHOLD. */
export const FALLBACK_KEEP_COUNT = 3;

export interface KeepDecision {
  /** One flag per input score, in input order. */
  readonly kept: boolean[];
  /** True when nothing was strong and these are the closest available. */
  readonly isFallback: boolean;
}

export function decideKeeps(scores: readonly (number | undefined)[]): KeepDecision {
  const isStrong = (s: number | undefined): s is number =>
    s !== undefined && s >= KEEP_THRESHOLD;
  if (scores.some(isStrong)) {
    return { kept: scores.map(isStrong), isFallback: false };
  }

  const closest = new Set(
    scores
      .map((score, index) => ({ score, index }))
      .filter((c): c is { score: number; index: number } =>
        c.score !== undefined && c.score >= FALLBACK_FLOOR,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, FALLBACK_KEEP_COUNT)
      .map((c) => c.index),
  );
  return {
    kept: scores.map((_, i) => closest.has(i)),
    isFallback: closest.size > 0,
  };
}
