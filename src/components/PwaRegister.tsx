"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaRegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore SW failures in dev */
      });
    }

    const dismissedKey = "bvs-install-dismissed";
    const wasDismissed = localStorage.getItem(dismissedKey) === "1";
    setDismissed(wasDismissed);

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    if (isStandalone) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!wasDismissed) setDismissed(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS: no beforeinstallprompt — show Share → Add to Home Screen tip once
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari && !wasDismissed) {
      setShowIosHint(true);
      setDismissed(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const close = () => {
    setDismissed(true);
    setDeferred(null);
    setShowIosHint(false);
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

  if (dismissed || (!deferred && !showIosHint)) return null;

  return (
    <div
      className="fixed bottom-24 left-4 right-4 z-[70] mx-auto max-w-md rounded-2xl border border-white/10 bg-[#12121a]/95 p-4 shadow-2xl backdrop-blur-md sm:left-auto sm:right-6"
      role="dialog"
      aria-label="Install BVS Radio"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-xl" width={48} height={48} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary">Install BVS Radio</p>
          <p className="mt-1 text-xs text-text-secondary">
            {showIosHint
              ? "On iPhone: tap Share → Add to Home Screen for the full app experience."
              : "Add to your home screen — listen like a native app on phone or tablet."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {deferred && (
              <button
                type="button"
                onClick={() => void install()}
                className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black"
              >
                Install app
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
