"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthActions } from "@/lib/auth/auth-actions";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";

export default function AuthErrorPage() {
  const params = useSearchParams();
  const message = params.get("message") ?? "An authentication error occurred.";
  const type = params.get("type") ?? "unknown";
  const { resendConfirmation } = useAuthActions();

  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const isExpired = type === "expired_link";
  const isOAuth = type === "oauth";

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await resendConfirmation(email);
      if (error) throw error;
      setNotice("A new confirmation link has been sent to your email.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to resend. Please try again.");
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
        <h1 className="mb-1 text-center text-xl font-semibold tracking-tight text-ink">
          {isExpired ? "Link expired" : isOAuth ? "Sign-in cancelled" : "Authentication error"}
        </h1>
        <p className="mb-7 text-center text-[13px] text-grey-500">
          {message}
        </p>

        {isExpired && (
          <div className="space-y-3">
            <p className="text-center text-[12.5px] text-grey-500">
              Enter your email to receive a new confirmation link.
            </p>
            <form onSubmit={handleResend} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-grey-200 bg-paper px-4 py-2.5 text-[13.5px] text-ink outline-none focus:border-grey-400"
              />
              {notice && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-[12px] text-emerald-700">
                  {notice}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-grey-800 disabled:opacity-50"
              >
                {busy ? "Sending..." : "Resend confirmation"}
              </button>
            </form>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-[12.5px] font-semibold text-ink underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
