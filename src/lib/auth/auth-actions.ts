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

  return { signInWithEmail, signUpWithEmail, signInWithGoogle, signOut };
}
