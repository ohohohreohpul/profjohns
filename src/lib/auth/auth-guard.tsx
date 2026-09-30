"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { PageLoader } from "@/components/brand/page-loader";

/** Routes accessible without signing in. The Discover dashboard ("/") is
 *  intentionally NOT public — unauthenticated visitors are redirected to
 *  login so the product is auth-gated for paying users. When auth is
 *  disabled (no Supabase env vars), the guard does nothing and local mode
 *  still works for development. */
const PUBLIC_ROUTES = ["/login", "/signup", "/pricing", "/terms", "/privacy"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, enabled } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/");

  React.useEffect(() => {
    if (!enabled || loading) return;

    if (!user && !isPublic) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, enabled, pathname, router, isPublic]);

  // Local mode (no Supabase env vars) — no auth gating, render everything.
  if (!enabled) return <>{children}</>;

  // Public routes (login, signup, auth callback, API) render normally.
  if (isPublic) return <>{children}</>;

  // Protected route + session still resolving → branded loader, not content.
  // This also covers the redirect-to-login moment: we show the loader while
  // router.replace is in flight so the dashboard never flashes to a visitor.
  if (loading || !user) return <PageLoader />;

  return <>{children}</>;
}