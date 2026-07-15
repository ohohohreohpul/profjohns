import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request.
 * When Supabase env vars are not set, this is a no-op (local-only mode).
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // No-op when Supabase is not configured — app runs in localStorage mode.
  if (!supabaseUrl || !supabaseKey) {
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
  // We do NOT server-side redirect here — the client-side AuthProvider
  // handles auth state and redirects to /login if needed. This avoids
  // race conditions where the session cookie hasn't synced yet.
  await supabase.auth.getUser();

  return supabaseResponse;
}
