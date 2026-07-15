import { type NextRequest, NextResponse } from "next/server";
import { canUseLocalMode } from "@/lib/config/env";

/**
 * Routes that are accessible without authentication.
 * Everything else requires a valid server-side session.
 */
export const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password"];

export function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/")
  );
}

/**
 * Determines whether a request to the given pathname requires authentication.
 */
export function isProtectedRoute(pathname: string): boolean {
  return !isPublicRoute(pathname);
}

/**
 * Server-side middleware that refreshes the Supabase session and redirects
 * unauthenticated users from protected routes to /login.
 *
 * This runs BEFORE the page renders, so protected content is never sent to
 * unauthenticated users. The redirect path is preserved in the `redirect`
 * query parameter for post-login recovery.
 */
export async function enforceAuth(request: NextRequest): Promise<NextResponse | null> {
  if (canUseLocalMode()) return null;
  if (!isProtectedRoute(request.nextUrl.pathname)) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const { createServerClient } = await import("@supabase/ssr");

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Validate the session server-side. getUser() makes a network call to
  // Supabase Auth to verify the JWT — this is the recommended SSR method,
  // NOT getSession() which only reads cookies and can be forged.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
