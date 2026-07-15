"use client";

import * as React from "react";
import Link from "next/link";
import { useAuthActions } from "@/lib/auth/auth-actions";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import { EnvelopeSimple } from "@phosphor-icons/react";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuthActions();

  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await resetPassword(email);
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-grey-50 px-6">
      <Link href="/" className="mb-10 flex flex-col items-center gap-3">
        <ProfJohnsLogo size={112} />
      </Link>

      <div className="w-full max-w-sm">
        {sent ? (
          <>
            <h1 className="mb-1 text-center text-xl font-semibold tracking-tight text-ink">
              Check your email
            </h1>
            <p className="mb-7 text-center text-[13px] text-grey-500">
              If an account exists for {email}, a password reset link has been sent.
            </p>
            <Link
              href="/login"
              className="block w-full rounded-xl bg-ink px-4 py-2.5 text-center text-[13.5px] font-semibold text-paper transition-colors hover:bg-grey-800"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-center text-xl font-semibold tracking-tight text-ink">
              Reset your password
            </h1>
            <p className="mb-7 text-center text-[13px] text-grey-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>

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

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-[12px] text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-grey-800 disabled:opacity-50"
              >
                {busy ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-[12.5px] text-grey-500">
          <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
