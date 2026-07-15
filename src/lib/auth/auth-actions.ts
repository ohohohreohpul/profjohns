"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export function useAuthActions() {
  const signInWithEmail = React.useCallback(
    async (email: string, password: string) => {
      const supabase = createClient();
      if (!supabase) return { error: { message: "Auth is not configured." } as unknown };
      return supabase.auth.signInWithPassword({ email, password });
    },
    [],
  );

  const signUpWithEmail = React.useCallback(
    async (email: string, password: string) => {
      const supabase = createClient();
      if (!supabase) return { data: { user: null, session: null }, error: { message: "Auth is not configured." } as unknown };
      return supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    },
    [],
  );

  const signInWithGoogle = React.useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  const signOut = React.useCallback(async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  /** Update the display name — writes auth user_metadata (drives the session
   *  immediately) AND the profiles row (best effort). */
  const updateDisplayName = React.useCallback(async (name: string) => {
    const supabase = createClient();
    if (!supabase) return { error: { message: "Auth is not configured." } as unknown };
    const clean = name.trim();
    const { error } = await supabase.auth.updateUser({ data: { full_name: clean } });
    if (!error) {
      // Keep the profiles table in sync (used by server-side reads).
      void supabase.auth.getUser().then(({ data }) => {
        const id = data.user?.id;
        if (id) void supabase.from("profiles").update({ display_name: clean }).eq("id", id);
      });
    }
    return { error };
  }, []);

  /** Set a new password (email-auth users). OAuth-only accounts can use this to
   *  add a password too. */
  const updatePassword = React.useCallback(async (password: string) => {
    const supabase = createClient();
    if (!supabase) return { error: { message: "Auth is not configured." } as unknown };
    return supabase.auth.updateUser({ password });
  }, []);

  /** Send a password reset email. The email contains a link to
   *  /auth/reset?code=... which Supabase exchanges for a session. */
  const resetPassword = React.useCallback(async (email: string) => {
    const supabase = createClient();
    if (!supabase) return { error: { message: "Auth is not configured." } as unknown };
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
  }, []);

  /** Resend the email confirmation link. */
  const resendConfirmation = React.useCallback(async (email: string) => {
    const supabase = createClient();
    if (!supabase) return { error: { message: "Auth is not configured." } as unknown };
    return supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  /** Sign out of all sessions (revokes all refresh tokens). */
  const signOutAllSessions = React.useCallback(async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/";
  }, []);

  return {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    updateDisplayName,
    updatePassword,
    resetPassword,
    resendConfirmation,
    signOutAllSessions,
  };
}
