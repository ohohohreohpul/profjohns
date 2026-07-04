/**
 * Pure merge logic for the workspace DB sync.
 *
 * The DB snapshot must never blindly replace local state: a canvas or project
 * created while the snapshot was loading (or whose debounced upload was killed
 * by a reload) exists only locally, and a blind replace erases it — the
 * "my new canvas disappeared / fell back to an old one" bug. Instead we merge:
 *
 * - present in both  → the newer `updatedAt` wins (keeps fresh local renames).
 * - only in DB       → keep (came from another device).
 * - only local       → KEEP and report as `localOnly` so the caller pushes it
 *                      up. Never destroy local work.
 *
 * Trade-off (documented, accepted for now): entries deleted on another device
 * can resurrect from this device's local copy until proper tombstones exist.
 * Losing a deletion is recoverable; losing fresh work is not.
 *
 * This module is deliberately dependency-free so it can be unit-tested
 * without loading stores or Supabase.
 */

export interface Stamped {
  id: string;
  updatedAt: number;
}

export interface MergeResult<T extends Stamped> {
  merged: T[];
  /** Entries that exist locally but not in the DB — must be pushed up. */
  localOnly: T[];
  /** True when the merged result differs from the DB snapshot (push needed). */
  dirty: boolean;
}

export function mergeById<T extends Stamped>(db: T[], local: T[]): MergeResult<T> {
  const byId = new Map<string, T>(db.map((d) => [d.id, d]));
  const localOnly: T[] = [];
  let dirty = false;

  for (const item of local) {
    const dbItem = byId.get(item.id);
    if (!dbItem) {
      byId.set(item.id, item);
      localOnly.push(item);
      dirty = true;
    } else if (item.updatedAt > dbItem.updatedAt) {
      byId.set(item.id, item);
      dirty = true;
    }
  }

  return { merged: [...byId.values()], localOnly, dirty };
}

/**
 * Merge pinned-source maps (projectId → sources). Union per project, deduped
 * by source id, DB entries first. Local-only pins survive the sync.
 */
export function mergePinned<S extends { id: string }>(
  db: Record<string, S[]>,
  local: Record<string, S[]>,
): { merged: Record<string, S[]>; dirty: boolean } {
  const merged: Record<string, S[]> = {};
  let dirty = false;

  const keys = new Set([...Object.keys(db), ...Object.keys(local)]);
  for (const key of keys) {
    const dbList = db[key] ?? [];
    const localList = local[key] ?? [];
    const seen = new Set(dbList.map((s) => s.id));
    const extras = localList.filter((s) => !seen.has(s.id));
    if (extras.length > 0) dirty = true;
    merged[key] = [...dbList, ...extras];
  }

  return { merged, dirty };
}
