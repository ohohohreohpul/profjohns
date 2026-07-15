import { NextRequest, NextResponse } from "next/server";

/**
 * CLIP embeddings via Replicate (VISION Phase 5b — figure search).
 *
 * Text and image both embed into the SAME CLIP space, so a text query can find
 * figures and a figure can find similar figures (reverse search). Uses the
 * model-based predictions endpoint with `Prefer: wait` (no version hash) so a
 * single request returns the embedding.
 *
 * Request:  POST { text?: string }  OR  { image: <url | data-URI> }
 * Response: { embedding: number[] }  (768-d)  |  { configured:false }  |  error
 *
 * DEPLOY-ONLY: needs REPLICATE_API_TOKEN. `REPLICATE_CLIP_MODEL` overrides the
 * default model (owner/name). Output parsing is defensive — CLIP embedders on
 * Replicate return the vector under a few different shapes.
 */

export const maxDuration = 60;

const DEFAULT_MODEL = process.env.REPLICATE_CLIP_MODEL ?? "krthr/clip-embeddings";
const EXPECTED_DIM = 768;

function extractEmbedding(output: unknown): number[] | null {
  // Common shapes: number[]; { embedding: number[] }; [{ embedding: number[] }].
  const asVec = (v: unknown): number[] | null =>
    Array.isArray(v) && v.every((n) => typeof n === "number") ? (v as number[]) : null;

  if (asVec(output)) return output as number[];
  if (output && typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (asVec(obj.embedding)) return obj.embedding as number[];
  }
  if (Array.isArray(output) && output[0] && typeof output[0] === "object") {
    const first = output[0] as Record<string, unknown>;
    if (asVec(first.embedding)) return first.embedding as number[];
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  let body: { text?: string; image?: string };
  try {
    body = (await request.json()) as { text?: string; image?: string };
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const input: Record<string, string> = {};
  if (body.text?.trim()) input.text = body.text.trim();
  else if (body.image?.trim()) input.image = body.image.trim();
  else return NextResponse.json({ error: "Provide text or image." }, { status: 400 });

  try {
    const res = await fetch(
      `https://api.replicate.com/v1/models/${DEFAULT_MODEL}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({ input }),
      },
    );
    const json = (await res.json()) as { output?: unknown; error?: unknown };
    if (!res.ok || json.error) {
      const msg = typeof json.error === "string" ? json.error : `Replicate ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    const embedding = extractEmbedding(json.output);
    if (!embedding) {
      return NextResponse.json(
        { error: "Unexpected embedding shape from the CLIP model." },
        { status: 502 },
      );
    }
    if (embedding.length !== EXPECTED_DIM) {
      return NextResponse.json(
        {
          error: `Model returned ${embedding.length}-d, expected ${EXPECTED_DIM}. Set REPLICATE_CLIP_MODEL to a ViT-L/14 CLIP embedder or update the schema dim.`,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ embedding });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "CLIP request failed." },
      { status: 500 },
    );
  }
}
