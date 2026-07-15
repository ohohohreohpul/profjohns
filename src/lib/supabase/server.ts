import { cookies } from "next/headers";
import { canUseLocalMode, IS_LOCAL, assertEnvironmentConfigured } from "@/lib/config/env";

/**
 * Server-side Supabase client.
 *
 * Returns null when running in explicitly-allowed local-only mode.
 * In preview/production, missing env vars throw rather than silently
 * disabling auth.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (canUseLocalMode()) return null;
    if (IS_LOCAL) assertEnvironmentConfigured();
    return null;
  }

  const { createServerClient } = await import("@supabase/ssr");
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore.
        }
      },
    },
  });
}
