"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
import {
  GA4_CONSENT_KEY,
  hasDoNotTrack,
  isPublicWebHost,
  shouldSkipGa4,
  type Ga4Consent,
} from "@/lib/ga4-web";

function readConsent(): Ga4Consent | null {
  try {
    const value = window.localStorage.getItem(GA4_CONSENT_KEY);
    if (value === "granted" || value === "denied") return value;
  } catch {
    /* private mode */
  }
  return null;
}

export default function Ga4ConsentSettings() {
  const pathname = usePathname() || "/";
  const { isNative } = useAppSurface();
  const [ready, setReady] = useState(false);
  const [webHost, setWebHost] = useState(false);
  const [dnt, setDnt] = useState(false);
  const [consent, setConsent] = useState<Ga4Consent | null>(null);
  const skip = shouldSkipGa4({ isNative, pathname });

  useEffect(() => {
    setWebHost(isPublicWebHost(window.location.hostname));
    setDnt(hasDoNotTrack(navigator, window as { doNotTrack?: string | null }));
    setConsent(readConsent());
    setReady(true);
  }, []);

  if (!ready || skip || !webHost) return null;

  function choose(next: Ga4Consent) {
    try {
      window.localStorage.setItem(GA4_CONSENT_KEY, next);
    } catch {
      /* ignore */
    }
    setConsent(next);
    window.location.reload();
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm font-semibold text-text-primary">Website analytics</p>
      {dnt ? (
        <p className="mt-2 text-sm text-text-secondary">
          Your browser sent Do Not Track, so Google Analytics is off on this device.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-text-secondary">
            Current choice: {consent === "granted" ? "allowed" : consent === "denied" ? "off" : "not set yet"}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => choose("granted")}
              className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-black"
            >
              Allow analytics
            </button>
            <button
              type="button"
              onClick={() => choose("denied")}
              className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-text-secondary"
            >
              Turn off
            </button>
          </div>
        </>
      )}
    </div>
  );
}
