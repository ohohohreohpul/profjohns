import { createBrowserClient } from "@supabase/ssr";
import { canUseLocalMode, assertEnvironmentConfigured, IS_LOCAL } from "@/lib/config/env";

/**
 * Browser-side Supabase client.
 *
 * Returns null when running in explicitly-allowed local-only mode
 * (ALLOW_LOCAL_MODE=true in a local environment).
 *
 * In preview/production, missing env vars throw rather than silently
 * disabling auth.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (canUseLocalMode()) return null;
    if (IS_LOCAL) {
      assertEnvironmentConfigured();
    }
    return null;
  }

  return createBrowserClient(url, key);
}

/** True when Supabase env vars are set (auth and cloud sync are active). */
export function isSupabaseEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
