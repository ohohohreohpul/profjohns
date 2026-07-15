import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireUser,
  authErrorResponse,
  AuthError,
  type FeatureKey,
  type AuthenticatedUser,
} from "@/lib/auth/server-auth";
import { canUseLocalMode } from "@/lib/config/env";
import {
  checkRateLimits,
  getClientIP,
  RATE_LIMITS,
  type RateLimitConfig,
} from "@/lib/security/rate-limit";

/**
 * API route protection wrapper.
 *
 * Combines authentication, entitlement, rate limiting, request body size
 * limits, and schema validation into a single middleware for vendor-funded
 * API routes.
 *
 * Usage:
 *
 *   export const POST = withApiAuth(
 *     { feature: "ai.write", rateLimit: RATE_LIMITS.ai, maxBodyBytes: 100_000 },
 *     async (user, req) => { ... },
 *   );
 */

export interface ApiAuthOptions {
  /** Feature entitlement required (e.g. "ai.write"). Defaults to just requiring auth. */
  feature?: FeatureKey;
  /** Rate limit config. Defaults to RATE_LIMITS.ai. */
  rateLimit?: RateLimitConfig;
  /** Maximum request body size in bytes. Defaults to 100KB. */
  maxBodyBytes?: number;
}

export interface ApiHandlerContext<T> {
  user: AuthenticatedUser;
  body: T;
  request: NextRequest;
}

type ApiHandler<T> = (
  ctx: ApiHandlerContext<T>,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API POST handler with authentication, rate limiting, body size
 * limits, and schema validation.
 */
export function withApiAuth<T>(
  options: ApiAuthOptions & { schema: z.ZodType<T> },
  handler: ApiHandler<T>,
): (request: NextRequest) => Promise<NextResponse> {
  const {
    feature,
    rateLimit = RATE_LIMITS.ai,
    maxBodyBytes = 100_000,
    schema,
  } = options;

  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // 0. Local mode bypass — tests and local dev use localStorage, no auth.
      if (canUseLocalMode()) {
        return await handleLocalMode(schema, request, handler);
      }

      // 1. Authenticate (and check entitlement if specified)
      let user: AuthenticatedUser;
      try {
        user = feature
          ? await requireEntitlementInternal(feature)
          : await requireUser();
      } catch (error) {
        if (error instanceof AuthError) return authErrorResponse(error);
        throw error;
      }

      // 2. Rate limit (per-user + per-IP)
      const ip = getClientIP(request);
      const route = request.nextUrl.pathname;
      const rateResult = checkRateLimits(user.id, ip, route, rateLimit);
      if (!rateResult.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please slow down." },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil((rateResult.resetAt - Date.now()) / 1000)),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(rateResult.resetAt),
            },
          },
        );
      }

      // 3. Body size limit
      const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
      if (contentLength > maxBodyBytes) {
        return NextResponse.json(
          { error: `Request body exceeds the ${maxBodyBytes} byte limit.` },
          { status: 413 },
        );
      }

      // 4. Parse and validate body
      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body." },
          { status: 400 },
        );
      }

      const parseResult = schema.safeParse(rawBody);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: "Request validation failed.",
            details: parseResult.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 400 },
        );
      }

      // 5. Call the handler with validated data
      return await handler({
        user,
        body: parseResult.data,
        request,
      });
    } catch (error) {
      // Never expose internal errors or stack traces to clients
      console.error("[API] Unexpected error:", error);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 },
      );
    }
  };
}

/**
 * Local mode handler — skips auth/rate-limit, still validates body.
 */
async function handleLocalMode<T>(
  schema: z.ZodType<T>,
  request: NextRequest,
  handler: ApiHandler<T>,
): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parseResult = schema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Request validation failed.",
        details: parseResult.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  // In local mode, use a synthetic local user
  const localUser: AuthenticatedUser = {
    id: "local-user",
    email: "local@localhost",
    emailConfirmed: true,
    userMetadata: {},
    appMetadata: {},
  };

  return await handler({
    user: localUser,
    body: parseResult.data,
    request,
  });
}

/**
 * Internal helper to call requireEntitlement.
 * Separated to avoid circular import issues.
 */
async function requireEntitlementInternal(feature: FeatureKey): Promise<AuthenticatedUser> {
  const { requireEntitlement } = await import("@/lib/auth/server-auth");
  return requireEntitlement(feature);
}
