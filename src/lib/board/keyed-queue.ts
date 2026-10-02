/**
 * Run async jobs one at a time per key, in the order they were queued.
 * Saves to one card go through the same key so a slow earlier save can
 * never land after (and overwrite) a later one. Different keys run freely.
 */
export type KeyedQueue = <T>(key: string, job: () => Promise<T>) => Promise<T>;

export function createKeyedQueue(): KeyedQueue {
  const tails = new Map<string, Promise<unknown>>();
  return <T>(key: string, job: () => Promise<T>): Promise<T> => {
    const previous = tails.get(key) ?? Promise.resolve();
    // Wait for the previous job to settle either way; its failure is its caller's.
    const next = previous.then(job, job);
    const tail = next.catch(() => undefined);
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return next;
  };
}
