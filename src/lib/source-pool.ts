/**
 * Building the pool of candidate papers that gets screened.
 */

/** Round-robin across lists, so every search angle is represented early. */
export function interleave<T>(lists: readonly (readonly T[])[]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
}

export interface Ranked<T> {
  readonly item: T;
  readonly score: number | null;
}

/** Highest score first; unscored items last; original order breaks ties. */
export function rankByScore<T>(
  items: readonly T[],
  scores: readonly (number | null | undefined)[],
): Ranked<T>[] {
  return items
    .map((item, index) => ({ item, score: scores[index] ?? null, index }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.index - b.index)
    .map(({ item, score }) => ({ item, score }));
}
