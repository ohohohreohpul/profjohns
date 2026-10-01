/** Ids present in `prev` but gone from `next` — what the user removed. */
export function removedIds(prev: readonly { id: string }[], next: readonly { id: string }[]): string[] {
  const kept = new Set(next.map((x) => x.id));
  return prev.filter((x) => !kept.has(x.id)).map((x) => x.id);
}
