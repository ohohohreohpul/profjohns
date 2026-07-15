import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { IS_PRODUCTION } from "@/lib/config/env";

/**
 * Service-role Supabase client — SERVER ONLY. Bypasses RLS, so it must never
 * be imported into client code and the key must never be NEXT_PUBLIC. Used by
 * the background cron (which has no user session) to read all users' standing
 * tasks and write findings on their behalf.
 *
 * Returns null when unconfigured. In production, callers must check for null
 * and fail rather than proceeding without the service client.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Asserts that the service client is available. Throws in production
 * when the service role key is missing.
 */
export function requireServiceClient() {
  const client = createServiceClient();
  if (!client) {
    throw new Error(
      IS_PRODUCTION
        ? "Service-role Supabase client is required but not configured. Set SUPABASE_SERVICE_ROLE_KEY."
        : "Service-role Supabase client not configured. Set SUPABASE_SERVICE_ROLE_KEY for background jobs.",
    );
  }
  return client;
}
