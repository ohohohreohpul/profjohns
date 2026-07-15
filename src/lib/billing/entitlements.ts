import { createClient } from "@/lib/supabase/server";
import type { FeatureKey } from "@/lib/auth/server-auth";

/**
 * Entitlement service — server-side feature gate enforcement.
 *
 * This is the single enforcement point for BILL-003. It queries the
 * entitlements table (not JWT metadata) to determine if a user has access
 * to a feature. All vendor-funded API routes call through requireEntitlement()
 * which calls this service.
 *
 * Usage:
 *   import { checkEntitlement } from "@/lib/billing/entitlements";
 *   const hasAccess = await checkEntitlement(userId, "ai.write");
 */

export interface EntitlementCheck {
  hasAccess: boolean;
  expiresAt: string | null;
  status: string | null;
}

/**
 * Checks if a user has an active entitlement for the given feature.
 * Queries the database directly — never reads from JWT metadata.
 */
export async function checkEntitlement(
  userId: string,
  feature: FeatureKey,
): Promise<EntitlementCheck> {
  const supabase = await createClient();
  if (!supabase) {
    // In local mode, all features are available
    return { hasAccess: true, expiresAt: null, status: "local" };
  }

  const { data, error } = await supabase
    .from("entitlements")
    .select("status, expires_at")
    .eq("user_id", userId)
    .eq("feature", feature)
    .maybeSingle();

  if (error) {
    console.error("[Entitlements] Error checking entitlement:", error);
    // Fail closed on error (except in local mode)
    return { hasAccess: false, expiresAt: null, status: "error" };
  }

  if (!data) {
    return { hasAccess: false, expiresAt: null, status: "none" };
  }

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { hasAccess: false, expiresAt: data.expires_at, status: "expired" };
  }

  // Check if revoked
  if (data.status !== "active") {
    return { hasAccess: false, expiresAt: data.expires_at, status: data.status };
  }

  return { hasAccess: true, expiresAt: data.expires_at, status: data.status };
}

/**
 * Checks if a user has ANY active entitlement (i.e., is a paid user).
 */
export async function isPaidUser(userId: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return true; // local mode

  const { count, error } = await supabase
    .from("entitlements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) return false;

  return (count ?? 0) > 0;
}

/**
 * Records a usage event to the database (replaces console logging).
 */
export async function recordUsageEvent(params: {
  userId: string;
  vendor: string;
  model: string | null;
  requestType: string;
  estimatedCostUsd: number | null;
  actualTokenUsage: number | null;
  status: string;
  errorMessage: string | null;
  durationMs: number;
}): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;

  const { error } = await supabase.from("usage_events").insert({
    user_id: params.userId,
    vendor: params.vendor,
    model: params.model,
    request_type: params.requestType,
    estimated_cost_usd: params.estimatedCostUsd,
    actual_token_usage: params.actualTokenUsage,
    status: params.status,
    error_message: params.errorMessage,
    duration_ms: params.durationMs,
  });

  if (error) {
    console.error("[Usage] Failed to record usage event:", error.message);
  }
}
