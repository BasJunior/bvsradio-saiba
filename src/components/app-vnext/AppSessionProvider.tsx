"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

export type AppAccess = {
  creator?: boolean;
  artist?: boolean;
  producer?: boolean;
  writer?: boolean;
  showCreator?: boolean;
  editorial?: boolean;
  admin?: boolean;
};

type AppSessionValue = {
  user: User | null;
  access: AppAccess | null;
  token: string;
  loading: boolean;
  signedIn: boolean;
  isCreator: boolean;
  premiumActive: boolean;
  premiumPlanLabel: string | null;
  refresh: () => Promise<void>;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<AppAccess | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [premiumActive, setPremiumActive] = useState(false);
  const [premiumPlanLabel, setPremiumPlanLabel] = useState<string | null>(null);

  const hydrate = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setUser(session?.user ?? null);
    setToken(session?.access_token || "");
    if (!session?.access_token) {
      setAccess(null);
      setPremiumActive(false);
      setPremiumPlanLabel(null);
      setLoading(false);
      return;
    }
    const response = await fetch("/api/auth/access", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }).catch(() => null);
    if (response?.ok) {
      const payload = (await response.json()) as {
        access?: AppAccess;
        premiumActive?: boolean;
        premiumPlanLabel?: string | null;
      };
      setAccess(payload.access || {});
      setPremiumActive(Boolean(payload.premiumActive));
      setPremiumPlanLabel(payload.premiumPlanLabel ?? null);
    } else {
      setAccess(null);
      setPremiumActive(false);
      setPremiumPlanLabel(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void hydrate();
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      void hydrate();
    });
    return () => data.subscription.unsubscribe();
  }, [hydrate]);

  const isCreator = Boolean(
    access?.creator || access?.artist || access?.producer || access?.writer || access?.showCreator || access?.admin,
  );

  const value = useMemo<AppSessionValue>(
    () => ({
      user,
      access,
      token,
      loading,
      signedIn: Boolean(user),
      isCreator,
      premiumActive,
      premiumPlanLabel,
      refresh: hydrate,
    }),
    [access, hydrate, isCreator, loading, premiumActive, premiumPlanLabel, token, user],
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) throw new Error("useAppSession must be used inside AppSessionProvider");
  return value;
}
