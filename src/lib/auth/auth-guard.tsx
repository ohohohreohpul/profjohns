"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

const PUBLIC_ROUTES = ["/", "/login", "/signup"];

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
