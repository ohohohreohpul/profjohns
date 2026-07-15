import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Returns null when env vars are not configured (local-only mode).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

/** True when Supabase env vars are set. */
export function isSupabaseEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
