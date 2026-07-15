import { canUseLocalMode } from "@/lib/config/env";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side authentication module.
 *
 * All functions validate identity server-side using the Supabase SSR method
 * (getUser() — network-verified, not client getSession() which only reads
 * cookies and can be forged).
 *
 * Usage in server components, layouts, and API route handlers:
 *
 *   import { requireUser } from "@/lib/auth/server-auth";
 *   const user = await requireUser();  // throws AuthError if unauthenticated
 *
 *   import { getOptionalUser } from "@/lib/auth/server-auth";
 *   const user = await getOptionalUser();  // returns null if unauthenticated
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public code:
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "LOCAL_MODE_DISABLED" = "UNAUTHENTICATED",
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
  userMetadata: Record<string, unknown>;
  appMetadata: Record<string, unknown>;
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email ?? "",
    emailConfirmed: !!user.email_confirmed_at,
    userMetadata: user.user_metadata ?? {},
    appMetadata: user.app_metadata ?? {},
  };
}

/**
 * Returns the authenticated user or null.
 * Does NOT throw — safe for optional auth contexts (public pages, etc.).
 *
 * Uses getUser() (network-verified JWT validation), NOT getSession()
 * (cookie-only, forgeable).
 */
export async function getOptionalUser(): Promise<AuthenticatedUser | null> {
  if (canUseLocalMode()) return null;

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return toAuthenticatedUser(user);
}

/**
 * Requires a valid authenticated user. Throws AuthError if:
 * - No session exists (UNAUTHENTICATED, 401)
 * - The session is expired or forged (UNAUTHENTICATED, 401)
 *
 * In API route handlers, catch AuthError and return the statusCode.
 * In server components, catch AuthError and redirect to /login.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  if (canUseLocalMode()) {
    throw new AuthError(
      "Authentication is required but local mode is active",
      "LOCAL_MODE_DISABLED",
      401,
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  if (!supabase) {
    throw new AuthError(
      "Authentication is not configured",
      "LOCAL_MODE_DISABLED",
      500,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError("Authentication required", "UNAUTHENTICATED", 401);
  }

  return toAuthenticatedUser(user);
}

/**
 * Feature keys for entitlement checks.
 * These will be enforced via database records once the billing system is live.
 */
export type FeatureKey =
  | "ai.write"
  | "ai.audit"
  | "ai.voice"
  | "agent.background"
  | "semantic.search"
  | "figure.search"
  | "cloud.sync";

/**
 * Requires the authenticated user AND the specified feature entitlement.
 * Throws AuthError (FORBIDDEN, 403) if the user lacks the entitlement.
 *
 * Until the billing system (BILL-002/BILL-003) is live, all authenticated
 * users are treated as having all entitlements. This function is the single
 * enforcement point — when the entitlement table exists, this is where the
 * database check goes.
 */
export async function requireEntitlement(
  feature: FeatureKey,
): Promise<AuthenticatedUser> {
  const user = await requireUser();

  // TODO (BILL-003): Check the entitlements table for this user + feature.
  // For now, all authenticated users have access. The enforcement point is
  // already in place — we just need to wire the database check here.
  void feature;

  return user;
}

/**
 * Converts an AuthError into a NextResponse for API route handlers.
 */
export function authErrorResponse(error: AuthError): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: error.message }),
    {
      status: error.statusCode,
      headers: { "Content-Type": "application/json" },
    },
  );
}
