import { NextResponse, type NextRequest } from "next/server";
import { canUseLocalMode, IS_LOCAL } from "@/lib/config/env";

/**
 * Refreshes the Supabase session on every request.
 *
 * When Supabase env vars are not set AND local mode is explicitly allowed
 * (ALLOW_LOCAL_MODE=true in local env), this is a no-op.
 *
 * In preview/production, missing env vars would have already caused a
 * build-time failure. If somehow reached without env vars, we pass through
 * rather than crash the request — the server-side auth layer will handle it.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (canUseLocalMode()) {
      return NextResponse.next({ request });
    }
    // In non-local envs without config, let the request pass —
    // server-side auth checks will reject unauthorized access.
    if (!IS_LOCAL) return NextResponse.next({ request });
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const { createServerClient } = await import("@supabase/ssr");

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() must be called to refresh the session token.
  await supabase.auth.getUser();

  return supabaseResponse;
}
