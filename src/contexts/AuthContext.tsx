import { completeSessionFromAuthRedirectUrl } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
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

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    async function handleAuthDeepLink(url: string | null) {
      if (!url || cancelled) return;
      await completeSessionFromAuthRedirectUrl(supabase, url);
    }

    async function init() {
      const initialUrl = await Linking.getInitialURL();
      await handleAuthDeepLink(initialUrl);

      if (cancelled) return;

      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(error ? null : data.session);
      } catch {
        if (cancelled) return;
        setSession(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void init();

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      void handleAuthDeepLink(url);
    });

    return () => {
      cancelled = true;
      linkSub.remove();
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
