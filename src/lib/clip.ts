"use client";

/**
 * CLIP figure-search client (VISION Phase 5b). Text and images embed into the
 * same 768-d CLIP space via /api/clip (Replicate), so text->figure and
 * figure->figure (reverse) search share one path. Returns null when CLIP
 * isn't configured (no REPLICATE_API_TOKEN) so callers can show "not set up".
 */

export const CLIP_DIM = 768;

async function clipEmbed(payload: { text?: string; image?: string }): Promise<number[] | null> {
  try {
    const res = await fetch("/api/clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as {
      embedding?: unknown;
      configured?: boolean;
    };
    if (json.configured === false) return null;
    const embedding = json.embedding;
    if (!Array.isArray(embedding) || embedding.length !== CLIP_DIM) return null;
    return embedding as number[];
  } catch {
    return null;
  }
}

/** Embed a text query into CLIP space (to find matching figures). */
export function clipEmbedText(text: string): Promise<number[] | null> {
  if (!text.trim()) return Promise.resolve(null);
  return clipEmbed({ text });
}

/** Embed an image (data-URL or hosted URL) into CLIP space. */
export function clipEmbedImage(image: string): Promise<number[] | null> {
  if (!image.trim()) return Promise.resolve(null);
  return clipEmbed({ image });
}
