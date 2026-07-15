import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiAuth } from "@/lib/security/api-auth";
import { withUsageTracking, sanitizeVendorError } from "@/lib/security/usage";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

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
 * Protected by withApiAuth: authentication, rate limiting, body validation.
 */

export const maxDuration = 60;

const DEFAULT_MODEL = process.env.REPLICATE_CLIP_MODEL ?? "krthr/clip-embeddings";
const EXPECTED_DIM = 768;

const clipRequestSchema = z.object({
  text: z.string().max(10_000).optional(),
  image: z.string().max(5_000_000).optional(),
}).refine(
  (data) => data.text?.trim() || data.image?.trim(),
  { message: "Provide text or image." },
);

function extractEmbedding(output: unknown): number[] | null {
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

export const POST = withApiAuth(
  {
    schema: clipRequestSchema,
    rateLimit: RATE_LIMITS.clip,
    maxBodyBytes: 500_000,
  },
  async ({ user, body }) => {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json({ configured: false }, { status: 200 });
    }

    const input: Record<string, string> = {};
    if (body.text?.trim()) input.text = body.text.trim();
    else if (body.image?.trim()) input.image = body.image.trim();

    try {
      const { result: json } = await withUsageTracking(
        {
          userId: user.id,
          vendor: "replicate",
          model: DEFAULT_MODEL,
          requestType: "clip",
          timeoutMs: 55_000,
        },
        async (signal) => {
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
              signal,
            },
          );
          if (!res.ok) throw new Error(`VENDOR:${res.status}`);
          return (await res.json()) as { output?: unknown; error?: unknown };
        },
      );

      if (json.error) {
        return NextResponse.json(
          { error: sanitizeVendorError("Replicate", 502) },
          { status: 502 },
        );
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
      const isVendorError = e instanceof Error && e.message.startsWith("VENDOR:");
      const status = isVendorError ? parseInt(e.message.split(":")[1], 10) : 500;
      const message = isVendorError
        ? sanitizeVendorError("Replicate", status)
        : e instanceof Error && e.name === "AbortError"
          ? "The request timed out. Please try again."
          : "CLIP request failed.";

      return NextResponse.json(
        { error: message },
        { status: isVendorError && status === 429 ? 429 : 502 },
      );
    }
  },
);
