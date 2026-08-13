"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  APP_SESSION_STORAGE_KEY,
  APP_SURFACE_STORAGE_KEY,
  appHome,
  parseSurfaceFromPath,
  resolveAppChrome,
  type AppSurface,
} from "@/lib/app-surface";

type AppSurfaceContextValue = {
  surface: AppSurface | null;
  appChrome: boolean;
  isNative: boolean;
  exitAppChrome: () => void;
};

const AppSurfaceContext = createContext<AppSurfaceContextValue>({
  surface: null,
  appChrome: false,
  isNative: false,
  exitAppChrome: () => undefined,
});

type ClientHints = {
  nativeSurface: AppSurface | null;
  storedSurface: AppSurface | null;
  inSession: boolean;
};

const emptyHints: ClientHints = { nativeSurface: null, storedSurface: null, inSession: false };
const hintListeners = new Set<() => void>();
let cachedHints = emptyHints;
let cachedHintKey = JSON.stringify(emptyHints);

function emitHints() {
  hintListeners.forEach((listener) => listener());
}

function detectNativeSurface(): AppSurface | null {
  try {
    const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
    if (!capacitor?.isNativePlatform?.()) return null;
    return capacitor.getPlatform?.() === "android" ? "android" : "ios";
  } catch {
    return null;
  }
}

function readHints(): ClientHints {
  if (typeof window === "undefined") return emptyHints;
  let next: ClientHints;
  try {
    const stored = window.sessionStorage.getItem(APP_SURFACE_STORAGE_KEY);
    next = {
      nativeSurface: detectNativeSurface(),
      storedSurface: stored === "ios" || stored === "android" ? stored : null,
      inSession: window.sessionStorage.getItem(APP_SESSION_STORAGE_KEY) === "1",
    };
  } catch {
    next = { nativeSurface: detectNativeSurface(), storedSurface: null, inSession: false };
  }
  const key = JSON.stringify(next);
  if (key === cachedHintKey) return cachedHints;
  cachedHintKey = key;
  cachedHints = next;
  return cachedHints;
}

function subscribeHints(listener: () => void) {
  hintListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    hintListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function persistSurface(surface: AppSurface) {
  try {
    window.sessionStorage.setItem(APP_SURFACE_STORAGE_KEY, surface);
    window.sessionStorage.setItem(APP_SESSION_STORAGE_KEY, "1");
    emitHints();
  } catch {
    /* ignore private-mode persistence failures */
  }
}

export function useAppSurface() {
  return useContext(AppSurfaceContext);
}

export default function AppSurfaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathSurface = parseSurfaceFromPath(pathname);
  const hints = useSyncExternalStore(subscribeHints, readHints, () => emptyHints);

  useEffect(() => {
    if (pathSurface) persistSurface(pathSurface);
    if (hints.nativeSurface && pathname === "/") {
      router.replace(appHome(hints.nativeSurface));
    }
  }, [hints.nativeSurface, pathSurface, pathname, router]);

  const resolved = useMemo(
    () => resolveAppChrome(pathname, {
      nativeSurface: hints.nativeSurface,
      storedSurface: pathSurface || hints.storedSurface,
      inSession: Boolean(pathSurface || hints.nativeSurface || hints.inSession),
    }),
    [hints.inSession, hints.nativeSurface, hints.storedSurface, pathSurface, pathname],
  );

  useEffect(() => {
    if (!resolved.appChrome || !resolved.surface) return;
    persistSurface(resolved.surface);
    document.documentElement.dataset.bvsSurface = resolved.surface;
    return () => {
      delete document.documentElement.dataset.bvsSurface;
    };
  }, [resolved.appChrome, resolved.surface]);

  const value = useMemo<AppSurfaceContextValue>(() => ({
    surface: resolved.surface,
    appChrome: resolved.appChrome,
    isNative: Boolean(hints.nativeSurface),
    exitAppChrome: () => {
      if (hints.nativeSurface) return;
      try {
        window.sessionStorage.removeItem(APP_SURFACE_STORAGE_KEY);
        window.sessionStorage.removeItem(APP_SESSION_STORAGE_KEY);
        emitHints();
      } catch {
        /* ignore */
      }
      router.push("/");
    },
  }), [hints.nativeSurface, resolved.appChrome, resolved.surface, router]);

  return <AppSurfaceContext.Provider value={value}>{children}</AppSurfaceContext.Provider>;
}
