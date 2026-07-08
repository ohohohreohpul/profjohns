"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { SignOut, GoogleLogo, Check, WarningCircle } from "@phosphor-icons/react";
import { SurfaceScaffold } from "@/components/workspace/workspace-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { useAuthActions } from "@/lib/auth/auth-actions";

type SaveState = "idle" | "saving" | "saved" | "error";

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong.";
}

/** Account & settings — profile, security, session. */
export function AccountSurface() {
  const { user, enabled, loading } = useAuth();
  const { updateDisplayName, updatePassword, signOut } = useAuthActions();

  if (loading) {
    return (
      <SurfaceScaffold title="Account">
        <p className="text-[13px] text-grey-400">Loading…</p>
      </SurfaceScaffold>
    );
  }

  // Local mode (no Supabase) or signed out — nothing to manage.
  if (!enabled || !user) {
    return (
      <SurfaceScaffold title="Account">
        <div className="mx-auto max-w-md rounded-xl border border-grey-200 bg-paper p-6 text-center shadow-sm">
          <p className="text-[14px] font-medium text-ink">
            {enabled ? "You're signed out" : "Running in local mode"}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-grey-500">
            {enabled
              ? "Sign in to manage your profile, security, and sync your work across devices."
              : "Accounts are disabled because Supabase isn't configured. Your work is saved locally in this browser only."}
          </p>
          {enabled && (
            <Link
              href="/login"
              data-testid="account-signin-link"
              className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-grey-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </SurfaceScaffold>
    );
  }

  const provider = (user.app_metadata?.provider as string | undefined) ?? "email";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const currentName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";
  const initial = (currentName || user.email || "?")[0]?.toUpperCase() ?? "?";

  return (
    <SurfaceScaffold title="Account" description={user.email ?? undefined}>
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <ProfileCard
          key={currentName}
          avatarUrl={avatarUrl}
          initial={initial}
          email={user.email ?? ""}
          provider={provider}
          currentName={currentName}
          onSave={updateDisplayName}
        />
        <SecurityCard provider={provider} onSave={updatePassword} />
        <SessionCard onSignOut={signOut} />
      </div>
    </SurfaceScaffold>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-grey-200 bg-paper p-5 shadow-sm">
      <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {description && (
        <p className="mt-0.5 text-[12.5px] text-grey-500">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SaveButton({
  state,
  disabled,
  label = "Save",
  testId,
}: {
  state: SaveState;
  disabled?: boolean;
  label?: string;
  testId: string;
}) {
  return (
    <button
      type="submit"
      data-testid={testId}
      disabled={disabled || state === "saving"}
      className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
    >
      {state === "saved" ? <Check className="size-4" /> : null}
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : label}
    </button>
  );
}

function ProfileCard({
  avatarUrl,
  initial,
  email,
  provider,
  currentName,
  onSave,
}: {
  avatarUrl?: string;
  initial: string;
  email: string;
  provider: string;
  currentName: string;
  onSave: (name: string) => Promise<{ error: unknown }>;
}) {
  const [name, setName] = React.useState(currentName);
  const [state, setState] = React.useState<SaveState>("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const { error } = await onSave(name);
    if (error) {
      setState("error");
      setError(getErrorMessage(error));
    } else {
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  return (
    <Card title="Profile" description="How you appear across ProfJohns.">
      <div className="mb-4 flex items-center gap-3">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={48}
            height={48}
            className="size-12 rounded-full"
          />
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-grey-100 text-[16px] font-semibold text-grey-600">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-medium text-ink">
            {currentName || "No name set"}
          </p>
          <p className="truncate font-mono text-[11.5px] text-grey-500">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label
            htmlFor="account-name"
            className="mb-1.5 block text-[12px] font-medium text-grey-600"
          >
            Display name
          </label>
          <input
            id="account-name"
            data-testid="account-name-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (state !== "idle") setState("idle");
            }}
            placeholder="Your name"
            className="w-full rounded-lg border border-grey-200 bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-grey-400"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[12px] font-medium text-grey-600">
            Email
          </span>
          <div className="flex items-center gap-2 rounded-lg border border-grey-200 bg-grey-50 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-grey-500">
              {email}
            </span>
            {provider === "google" && (
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-grey-400">
                <GoogleLogo className="size-3.5" weight="fill" /> Google
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-grey-400">
            Email changes aren&apos;t supported yet — contact support to update it.
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-[12px] text-red-600">
            <WarningCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <div>
          <SaveButton
            state={state}
            disabled={name.trim() === currentName.trim()}
            testId="account-name-save"
          />
        </div>
      </form>
    </Card>
  );
}

function SecurityCard({
  provider,
  onSave,
}: {
  provider: string;
  onSave: (password: string) => Promise<{ error: unknown }>;
}) {
  const [pw, setPw] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [state, setState] = React.useState<SaveState>("idle");
  const [error, setError] = React.useState<string | null>(null);

  const mismatch = confirm.length > 0 && pw !== confirm;
  const tooShort = pw.length > 0 && pw.length < 6;
  const canSave = pw.length >= 6 && pw === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setState("saving");
    setError(null);
    const { error } = await onSave(pw);
    if (error) {
      setState("error");
      setError(getErrorMessage(error));
    } else {
      setState("saved");
      setPw("");
      setConfirm("");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  return (
    <Card
      title="Password"
      description={
        provider === "google"
          ? "You signed in with Google. You can also set a password to sign in with email."
          : "Set a new password for email sign-in."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label
            htmlFor="account-pw"
            className="mb-1.5 block text-[12px] font-medium text-grey-600"
          >
            New password
          </label>
          <input
            id="account-pw"
            type="password"
            data-testid="account-password-input"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (state !== "idle") setState("idle");
            }}
            placeholder="At least 6 characters"
            className="w-full rounded-lg border border-grey-200 bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-grey-400"
          />
        </div>
        <div>
          <label
            htmlFor="account-pw-confirm"
            className="mb-1.5 block text-[12px] font-medium text-grey-600"
          >
            Confirm password
          </label>
          <input
            id="account-pw-confirm"
            type="password"
            data-testid="account-password-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
            className="w-full rounded-lg border border-grey-200 bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-grey-400"
          />
        </div>

        {(mismatch || tooShort || error) && (
          <p className="flex items-center gap-1.5 text-[12px] text-red-600">
            <WarningCircle className="size-3.5 shrink-0" />
            {error ?? (tooShort ? "Password must be at least 6 characters." : "Passwords don't match.")}
          </p>
        )}

        <div>
          <SaveButton
            state={state}
            disabled={!canSave}
            label="Update password"
            testId="account-password-save"
          />
        </div>
      </form>
    </Card>
  );
}

function SessionCard({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Card title="Session" description="Sign out of this browser.">
      <button
        onClick={() => onSignOut()}
        data-testid="account-signout"
        className="inline-flex items-center gap-2 rounded-md border border-grey-200 bg-paper px-3.5 py-2 text-[13px] font-medium text-grey-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        <SignOut className="size-4" />
        Sign out
      </button>
    </Card>
  );
}
