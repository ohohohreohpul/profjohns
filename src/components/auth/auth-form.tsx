"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import { useAuthActions } from "@/lib/auth/auth-actions";
import { EnvelopeSimple, Lock, GoogleLogo } from "@phosphor-icons/react";
import Image from "next/image";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const rawRedirect = useSearchParams().get("redirect") ?? "/";
  // Validate redirect to prevent open redirect attacks
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuthActions();

  // Google OAuth is shown only when explicitly enabled via env var
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const isLogin = mode === "login";

  function sanitizeAuthError(err: unknown): string {
    const msg = err instanceof Error ? err.message : "Something went wrong.";
    // Map common Supabase error messages to user-readable recovery actions
    if (msg.includes("Invalid login credentials")) {
      return "Incorrect email or password. Please try again.";
    }
    if (msg.includes("Email not confirmed")) {
      return "Please confirm your email before signing in. Check your inbox for the confirmation link.";
    }
    if (msg.includes("User already registered")) {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (msg.includes("Password should be at least")) {
      return "Password must be at least 6 characters.";
    }
    if (msg.includes("rate limit") || msg.includes("too many")) {
      return "Too many attempts. Please wait a moment and try again.";
    }
    // Never expose raw Supabase internal errors
    return msg;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (isLogin) {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
        window.location.href = redirect;
      } else {
        const { error, data } = await signUpWithEmail(email, password);
        if (error) throw error;
        if (data.user && !data.session) {
          setNotice("Check your email for a confirmation link to complete your signup.");
        } else if (data.session) {
          window.location.href = redirect;
        }
      }
    } catch (err: unknown) {
      setError(sanitizeAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setBusy(false);
      setError("Google sign-in failed to start.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-grey-50 px-6">
      {/* Logo */}
      <Link href="/" className="mb-10 flex flex-col items-center gap-3">
        <ProfJohnsLogo size={112} />
        <img
          src="/profjohns-text.svg"
          
          className="h-[36px] w-auto"
          alt="ProfJohns"
        />
      </Link>

      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-semibold tracking-tight text-ink">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mb-7 text-center text-[13px] text-grey-500">
          {isLogin
            ? "Sign in to your research workspace"
            : "Start researching with AI-powered sources"}
        </p>

        {/* Google OAuth — shown only when enabled */}
        {googleEnabled && (
          <>
            <button
              onClick={handleGoogle}
              disabled={busy}
              className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-xl border border-grey-200 bg-paper px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-grey-50 disabled:opacity-50"
            >
              <GoogleLogo className="size-5" weight="fill" />
              Continue with Google
            </button>

            {/* Divider */}
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-grey-200" />
              <span className="text-[11px] font-medium text-grey-500">or</span>
              <div className="h-px flex-1 bg-grey-200" />
            </div>
          </>
        )}

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-grey-600">
              Email
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-grey-200 bg-paper px-3 py-2.5 transition-colors focus-within:border-grey-400">
              <EnvelopeSimple className="size-4 shrink-0 text-grey-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-grey-500"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-[12px] font-medium text-grey-600">
                Password
              </label>
              {isLogin && (
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-medium text-grey-500 underline-offset-4 hover:underline"
                >
                  Forgot?
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-grey-200 bg-paper px-3 py-2.5 transition-colors focus-within:border-grey-400">
              <Lock className="size-4 shrink-0 text-grey-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-grey-500"
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              aria-live="assertive"
              className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-[12px] text-red-600"
            >
              {error}
            </p>
          )}

          {notice && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-[12px] text-emerald-700"
            >
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-grey-800 disabled:opacity-50"
          >
            {busy
              ? "Please wait…"
              : isLogin
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {/* Switch link */}
        <p className="mt-6 text-center text-[12.5px] text-grey-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <Link
            href={isLogin ? `/signup?redirect=${redirect}` : `/login?redirect=${redirect}`}
            className="font-semibold text-ink underline-offset-4 hover:underline"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
