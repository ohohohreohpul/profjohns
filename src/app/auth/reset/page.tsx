"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@/lib/auth/auth-actions";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import { Lock } from "@phosphor-icons/react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword } = useAuthActions();

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      router.push("/canvas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
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
          Set a new password
        </h1>
        <p className="mb-7 text-center text-[13px] text-grey-500">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-grey-600">
              New password
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-grey-200 bg-paper px-3 py-2.5 transition-colors focus-within:border-grey-400">
              <Lock className="size-4 shrink-0 text-grey-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-grey-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-grey-600">
              Confirm password
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-grey-200 bg-paper px-3 py-2.5 transition-colors focus-within:border-grey-400">
              <Lock className="size-4 shrink-0 text-grey-500" />
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
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
            {busy ? "Updating..." : "Update password"}
          </button>
        </form>

        <p className="mt-6 text-center text-[12.5px] text-grey-500">
          <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
