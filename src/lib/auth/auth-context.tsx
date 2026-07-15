"use client";

import * as React from "react";
import { isSupabaseEnabled } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** True when Supabase env vars are configured. When false, auth is disabled
   *  and the app runs in local-only (localStorage) mode. */
  enabled: boolean;
}

const AuthContext = React.createContext<AuthState>({
  user: null,
  loading: true,
  enabled: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    loading: true,
    enabled: false,
  });

  React.useEffect(() => {
    const enabled = isSupabaseEnabled();

    if (!enabled) {
      setState({ user: null, loading: false, enabled: false });
      return;
    }

    // Dynamic import so the Supabase SDK isn't loaded when disabled.
    let unsub: (() => void) | undefined;

    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      if (!supabase) {
        setState({ user: null, loading: false, enabled: false });
        return;
      }

      // Seed from getSession() — it reads the session straight from cookies
      // with NO network round-trip, so a valid signed-in session resolves
      // immediately. (getUser() validates over the network and would
      // false-logout the user — bouncing them to /login — on any transient
      // failure, slow response, or rate limit.) The server boundary still
      // validates via getUser() in the proxy, backed by RLS.
      supabase.auth.getSession().then(({ data: { session } }) => {
        setState({ user: session?.user ?? null, loading: false, enabled: true });
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setState({
          user: session?.user ?? null,
          loading: false,
          enabled: true,
        });
      });

      unsub = () => subscription.unsubscribe();
    });

    return () => {
      unsub?.();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return React.useContext(AuthContext);
}
