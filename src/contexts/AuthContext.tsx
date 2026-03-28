import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { type ReactNode, createContext, useEffect, useState } from "react";

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        setSession(error ? null : data.session);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
