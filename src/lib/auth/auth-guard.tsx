"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

/** Routes accessible without signing in. The Discover dashboard ("/") is
 *  intentionally NOT public — unauthenticated visitors are redirected to
 *  login so the product is auth-gated for paying users. When auth is
 *  disabled (no Supabase env vars), the guard does nothing and local mode
 *  still works for development. */
const PUBLIC_ROUTES = ["/login", "/signup"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, enabled } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!enabled || loading) return;

    const isPublic = PUBLIC_ROUTES.includes(pathname) ||
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/api/");

    if (!user && !isPublic) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, enabled, pathname, router]);

  return <>{children}</>;
}
