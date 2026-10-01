import { NextResponse } from "next/server";

import {
  isJevConfigured,
  JevError,
  judgeClaimSupport,
  routeAnglesToSources,
  scoreSourcesRelevance,
  type AngleRoutingInput,
  type ClaimSupportInput,
  type JevSourceContext,
} from "@/lib/jev";
import { verifyReferences, type ReferenceVerification } from "@/lib/verify-refs";
import type { PaperSource } from "@/lib/mock";
import type { SourceProvider } from "@/lib/sources-client";

/** Caps one request's Jev cost (~500 tokens per source). */
const MAX_SCORE_SOURCES = 40;

export const runtime = "nodejs";

/**
 * Jev (TypeSafe System One) boundary — server-side only.
 *
 * Keeps TYPESAFE_API_KEY off the client and exposes the structured decisions
 * the app delegates to Jev:
 *   - route-angles      : pick the best source DB per search angle (Choice)
 *   - score-sources     : rate each candidate source's relevance (Score)
 *   - audit-claims      : does each cited source support its claim? (Noul)   [E0.2]
 *   - verify-references : does each cited reference exist in OpenAlex?       [E0.1]
 *
 * The first three require a key and return configured:false when unset (caller
 * falls back to the LLM-only path). `verify-references` works WITHOUT a key:
 * it does OpenAlex retrieval + a code fuzzy match, and uses Jev for the
 * same-work judgment only when the key is present.
 */

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  configured: boolean;
}

type RouteAnglesBody = {
  op: "route-angles";
  topic: string;
  angles: AngleRoutingInput[];
  allowedSources: SourceProvider[];
};

type ScoreSourcesBody = {
  op: "score-sources";
  topic: string;
  sources: JevSourceContext[];
};

type AuditClaimsBody = {
  op: "audit-claims";
  draft: string;
  findings: ClaimSupportInput[];
  sources: JevSourceContext[];
};

type VerifyRefsBody = {
  op: "verify-references";
  sources: PaperSource[];
};

type JevRequestBody =
  | RouteAnglesBody
  | ScoreSourcesBody
  | AuditClaimsBody
  | VerifyRefsBody;

function notConfigured<T>(error: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: false, data: null, error, configured: false },
    { status: 503 },
  );
}

function ok<T>(data: T, configured = true): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, error: null, configured });
}

function fail<T>(error: string, status = 500, configured = true): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: false, data: null, error, configured },
    { status },
  );
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<unknown>>> {
  let body: JevRequestBody;
  try {
    body = (await req.json()) as JevRequestBody;
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  if (body.op === "verify-references") {
    // Works without a Jev key (OpenAlex retrieval + code fuzzy-match fallback).
    if (!Array.isArray(body.sources)) {
      return fail("verify-references requires a `sources` array.", 400);
    }
    try {
      const results: ReferenceVerification[] = await verifyReferences(body.sources);
      return ok(results, isJevConfigured());
    } catch (err: unknown) {
      const msg = err instanceof JevError ? err.message : "Reference verification failed.";
      return fail(msg);
    }
  }

  // All remaining ops require a Jev key.
  if (!isJevConfigured()) {
    return notConfigured("Jev is not configured. Set TYPESAFE_API_KEY.");
  }

  if (body.op === "route-angles") {
    if (!Array.isArray(body.angles) || !Array.isArray(body.allowedSources)) {
      return fail("route-angles requires `angles` and `allowedSources` arrays.", 400);
    }
    try {
      const providers = await routeAnglesToSources(
        body.topic ?? "",
        body.angles,
        body.allowedSources,
      );
      return ok(providers);
    } catch (err: unknown) {
      const msg = err instanceof JevError ? err.message : "Jev routing failed.";
      return fail(msg);
    }
  }

  if (body.op === "score-sources") {
    if (!Array.isArray(body.sources)) {
      return fail("score-sources requires a `sources` array.", 400);
    }
    if (body.sources.length > MAX_SCORE_SOURCES) {
      return fail(`score-sources accepts at most ${MAX_SCORE_SOURCES} sources.`, 400);
    }
    try {
      const scores = await scoreSourcesRelevance(body.topic ?? "", body.sources);
      return ok(scores);
    } catch (err: unknown) {
      const msg = err instanceof JevError ? err.message : "Jev scoring failed.";
      return fail(msg);
    }
  }

  if (body.op === "audit-claims") {
    if (!Array.isArray(body.findings) || !Array.isArray(body.sources)) {
      return fail("audit-claims requires `findings` and `sources` arrays.", 400);
    }
    try {
      const probabilities = await judgeClaimSupport(
        body.draft ?? "",
        body.findings,
        body.sources,
      );
      return ok(probabilities);
    } catch (err: unknown) {
      const msg = err instanceof JevError ? err.message : "Jev audit failed.";
      return fail(msg);
    }
  }

  return fail(`Unknown op: ${String((body as { op?: string }).op ?? "(missing)")}.`, 400);
}