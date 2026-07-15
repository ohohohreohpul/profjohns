import { NextResponse } from "next/server";
import { canUseLocalMode } from "@/lib/config/env";

/**
 * OAuth/email confirmation callback.
 *
 * Exchanges the auth code for a session and redirects to the saved redirect
 * path. If the code is missing, expired, or invalid, redirects to the auth
 * error page with a recovery action.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect = requestUrl.searchParams.get("redirect") ?? "/";
  const errorDescription = requestUrl.searchParams.get("error_description");
  const error = requestUrl.searchParams.get("error");

  // Handle OAuth provider errors (e.g. user denied consent)
  if (error || errorDescription) {
    const message = errorDescription || error || "Authentication failed.";
    return NextResponse.redirect(
      new URL(`/auth/error?message=${encodeURIComponent(message)}&type=oauth`, requestUrl.origin),
    );
  }

  if (canUseLocalMode()) {
    return NextResponse.redirect(`${requestUrl.origin}${redirect}`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!code) {
    return NextResponse.redirect(
      new URL(`/auth/error?message=${encodeURIComponent("Missing confirmation code.")}&type=missing_code`, requestUrl.origin),
    );
  }

  if (!url || !key) {
    return NextResponse.redirect(
      new URL(`/auth/error?message=${encodeURIComponent("Authentication is not configured.")}&type=config`, requestUrl.origin),
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.redirect(
      new URL(`/auth/error?message=${encodeURIComponent("Authentication service unavailable.")}&type=config`, requestUrl.origin),
    );
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const isExpired = exchangeError.message.includes("expired") || exchangeError.message.includes("invalid");
    const type = isExpired ? "expired_link" : "exchange_failed";
    return NextResponse.redirect(
      new URL(`/auth/error?message=${encodeURIComponent(exchangeError.message)}&type=${type}`, requestUrl.origin),
    );
  }

  return NextResponse.redirect(`${requestUrl.origin}${redirect}`);
}
