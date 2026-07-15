"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Semantic retrieval client (VISION Phase 5). Embeddings are produced by the
 * Supabase `embed` Edge Function (gte-small, 384-d, no external vendor);
 * search ranks via the `match_sources` pgvector RPC. Everything degrades to
 * null/no-op when Supabase or the function isn't configured, so the app is
 * unaffected until the phase is deployed.
 */

export const EMBED_DIM = 384;

/** Cosine similarity of two equal-length vectors, in [-1, 1]. Pure — the unit
 *  of the ranking; unit-tested. Returns 0 for degenerate input. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Embed text via the `embed` Edge Function. Returns null when unavailable
 *  (signed out / unconfigured / function not deployed) — callers treat null as
 *  "semantic search isn't set up". */
export async function embedText(text: string): Promise<number[] | null> {
  const sb = createClient();
  if (!sb || !text.trim()) return null;
  try {
    const { data, error } = await sb.functions.invoke("embed", {
      body: { text },
    });
    if (error) return null;
    const embedding = (data as { embedding?: unknown })?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBED_DIM) return null;
    return embedding as number[];
  } catch {
    return null;
  }
}
