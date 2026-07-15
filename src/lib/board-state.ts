/**
 * Validation for canvas-board blobs coming back from the DB (cross-device
 * read). Deliberately dependency-free so it can be unit-tested without
 * loading stores or Supabase.
 */

/** The persisted-board keys a DB blob may contribute — the exact
 *  partialize/snapshot shape. Anything else is dropped so a DB row can never
 *  inject transient/unknown state into the store. */
const BOARD_STATE_KEYS = [
  "direction",
  "nodes",
  "edges",
  "creditsUsed",
  "nextId",
  "docs",
  "sources",
  "highlights",
  "extracts",
  "seeded",
  "hintSeen",
] as const;

/**
 * Validate + sanitize a board blob. Returns the picked known keys, or null
 * when the blob isn't a plausible board (never trust external data — a
 * malformed row must fall through to a fresh seed, not crash the canvas).
 */
export function sanitizeBoardState(
  blob: unknown,
): Record<string, unknown> | null {
  if (typeof blob !== "object" || blob === null || Array.isArray(blob)) {
    return null;
  }
  const record = blob as Record<string, unknown>;
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) return null;
  if (record.nodes.length === 0) return null; // empty blob — seed instead

  const picked: Record<string, unknown> = {};
  for (const key of BOARD_STATE_KEYS) {
    if (key in record) picked[key] = record[key];
  }
  return picked;
}
