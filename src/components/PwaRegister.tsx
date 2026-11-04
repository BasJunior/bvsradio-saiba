"use client";

import { useEffect, useState } from "react";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaRegister() {
  const { appChrome } = useAppSurface();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window === "undefined" || localStorage.getItem("bvs-install-dismissed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register service worker
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore SW failures in dev */
      });
    }

    const dismissedKey = "bvs-install-dismissed";
    let wasDismissed = false;
    try { wasDismissed = localStorage.getItem(dismissedKey) === "1"; } catch { /* storage is optional */ }
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    if (isStandalone) return;

    const engagementTimer = window.setTimeout(() => setEngaged(true), 60_000);
    const onEngagement = () => setEngaged(true);
    window.addEventListener("bvs:player-open", onEngagement, { once: true });
    window.addEventListener("bvs:library-change", onEngagement, { once: true });

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      window.dispatchEvent(new CustomEvent("bvs:pwa-install-available"));
      if (!wasDismissed) setDismissed(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const onInstallRequest = () => {
      setEngaged(true);
      setDismissed(false);
    };
    window.addEventListener("bvs:pwa-install-request", onInstallRequest);

    return () => {
      window.clearTimeout(engagementTimer);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("bvs:player-open", onEngagement);
      window.removeEventListener("bvs:library-change", onEngagement);
      window.removeEventListener("bvs:pwa-install-request", onInstallRequest);
    };
  }, []);

  const close = () => {
    setDismissed(true);
    setDeferred(null);
    try {
      localStorage.setItem("bvs-install-dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    close();
  };

  useEffect(() => {
    const onInstallRequest = () => {
      if (deferred) void install();
    };
    window.addEventListener("bvs:pwa-install-request", onInstallRequest);
    return () => window.removeEventListener("bvs:pwa-install-request", onInstallRequest);
  });

  if (appChrome || dismissed || !engaged || !deferred) return null;

  return (
    <div
      className="fixed bottom-[calc(var(--bvs-app-bottom-stack-height)+1rem)] left-4 right-4 z-[70] mx-auto max-h-[calc(100dvh-var(--bvs-app-bottom-stack-height)-5rem)] max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1C]/95 p-4 shadow-2xl backdrop-blur-md sm:left-auto sm:right-6"
      role="dialog"
      aria-label="Install BVS Radio"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/bvs-monogram-v2.svg" alt="" className="h-12 w-12 rounded-xl" width={48} height={48} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary">Install BVS Radio</p>
          <p className="mt-1 text-xs text-text-secondary">
            {/(Android)/i.test(navigator.userAgent)
              ? "Keep BVS Radio one tap away. Open your music, discovery and library from your home screen."
              : "Install BVS Radio on this device for quick, full-screen access to music and creator tools."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {deferred && (
              <button
                type="button"
                onClick={() => void install()}
                className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black"
              >
                Install BVS Radio
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-white/15 px-4 py-2 text-xs text-text-secondary"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
