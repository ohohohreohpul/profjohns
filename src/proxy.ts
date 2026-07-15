import { updateSession } from "@/lib/supabase/middleware";
import { enforceAuth } from "@/lib/auth/middleware-auth";
import { canUseLocalMode } from "@/lib/config/env";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  // In local mode, skip all auth enforcement.
  if (canUseLocalMode()) {
    return await updateSession(request);
  }

  // 1. Enforce server-side auth: redirect unauthenticated users from
  //    protected routes to /login BEFORE any page content renders.
  const authResponse = await enforceAuth(request);
  if (authResponse) return authResponse;

  // 2. Refresh the Supabase session cookie.
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
