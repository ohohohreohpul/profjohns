/**
 * Fractional ordering for walls and cards: a new position always fits between
 * two neighbours, so a move updates one row instead of renumbering a column.
 */

/** Gap used when appending, or when laying out a fresh list. */
export const POSITION_STEP = 1024;

/** A position strictly between `before` and `after` (either may be absent). */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return (after as number) - POSITION_STEP;
  if (after === undefined) return before + POSITION_STEP;
  return (before + after) / 2;
}

/** Evenly spaced increasing positions for `count` items. */
export function positionsFor(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}
