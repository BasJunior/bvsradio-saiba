"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { withAuthTimeout } from "@/lib/auth-client-flow";
import { Capacitor } from "@capacitor/core";
import { getPushPermission, isNativeRuntime, registerPushDevice } from "@/lib/app-native";

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
  avatarUrl: string | null;
  profileDisplayName: string | null;
  profileUsername: string | null;
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [premiumActive, setPremiumActive] = useState(false);
  const [premiumPlanLabel, setPremiumPlanLabel] = useState<string | null>(null);

  const hydrationVersion = useRef(0);
  const accountId = useRef("");

  const clearAccess = useCallback(() => {
    setAccess(null);
    setAvatarUrl(null);
    setProfileDisplayName(null);
    setProfileUsername(null);
    setPremiumActive(false);
    setPremiumPlanLabel(null);
  }, []);

  const applySession = useCallback(async (session: Session | null) => {
    const version = ++hydrationVersion.current;
    const nextAccount = session?.user.id || "";
    if (accountId.current !== nextAccount) {
      accountId.current = nextAccount;
      clearAccess();
    }
    setUser(session?.user ?? null);
    setToken(session?.access_token || "");
    if (!session?.access_token) {
      clearAccess();
      setLoading(false);
      return;
    }
    const response = await fetch("/api/auth/access", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) as {
      access?: AppAccess;
      profileAvatarUrl?: string | null;
      profileDisplayName?: string | null;
      profileUsername?: string | null;
      premiumActive?: boolean;
      premiumPlanLabel?: string | null;
    } | null : null;
    // A slow previous-account response must never restore its role or identity.
    if (version !== hydrationVersion.current) return;
    if (payload) {
      setAccess(payload.access || {});
      setAvatarUrl(payload.profileAvatarUrl || null);
      setProfileDisplayName(payload.profileDisplayName || null);
      setProfileUsername(payload.profileUsername || null);
      setPremiumActive(Boolean(payload.premiumActive));
      setPremiumPlanLabel(payload.premiumPlanLabel ?? null);
    } else clearAccess();
    setLoading(false);
  }, [clearAccess]);

  const hydrate = useCallback(async () => {
    if (!isSupabaseConfigured()) { clearAccess(); setLoading(false); return; }
    const version = ++hydrationVersion.current;
    try {
      const { data } = await withAuthTimeout(createClient().auth.getSession(), 12000, "Session refresh timed out.");
      if (version === hydrationVersion.current) await applySession(data.session);
    } catch {
      if (version === hydrationVersion.current) { clearAccess(); setLoading(false); }
    }
  }, [applySession, clearAccess]);

  const invalidateHydration = useCallback(() => { ++hydrationVersion.current; }, []);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Keep Supabase calls out of its auth callback/lock. Use the supplied session
    // after the callback has returned instead of calling getSession inside it.
    timer = setTimeout(() => { if (alive) void hydrate(); }, 0);
    if (!isSupabaseConfigured()) return () => { alive = false; clearTimeout(timer); };
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      invalidateHydration();
      clearTimeout(timer);
      timer = setTimeout(() => { if (alive) { setLoading(true); void applySession(session); } }, 0);
    });
    return () => {
      alive = false;
      invalidateHydration();
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [applySession, hydrate, invalidateHydration]);

  useEffect(() => {
    if (!token || !isNativeRuntime()) return;
    let alive = true;
    let registering = false;
    const refreshPush = async () => {
      if (!alive || registering) return;
      registering = true;
      try {
        const permission = await getPushPermission();
        if (!alive || permission !== "granted") return;
        const platform = Capacitor.getPlatform() === "android" ? "android" : "ios";
        const result = await registerPushDevice(token, platform);
        if (alive && !result.ok) window.dispatchEvent(new CustomEvent("bvs:push-registration", { detail: result }));
      } finally { registering = false; }
    };
    void refreshPush();
    // Retry once the native bridge is ready and after returning from iPhone Settings/offline.
    const readyTimer = window.setTimeout(() => void refreshPush(), 4000);
    const onResume = () => void refreshPush();
    window.addEventListener("bvs:app-resume", onResume);
    window.addEventListener("online", onResume);
    return () => {
      alive = false; window.clearTimeout(readyTimer);
      window.removeEventListener("bvs:app-resume", onResume);
      window.removeEventListener("online", onResume);
    };
  }, [token]);

  const isCreator = Boolean(
    access?.creator || access?.artist || access?.producer || access?.writer || access?.showCreator || access?.admin,
  );

  const value = useMemo<AppSessionValue>(
    () => ({
      user,
      access,
      token,
      avatarUrl,
      profileDisplayName,
      profileUsername,
      loading,
      signedIn: Boolean(user),
      isCreator,
      premiumActive,
      premiumPlanLabel,
      refresh: hydrate,
    }),
    [access, avatarUrl, hydrate, isCreator, loading, premiumActive, premiumPlanLabel, profileDisplayName, profileUsername, token, user],
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) throw new Error("useAppSession must be used inside AppSessionProvider");
  return value;
}