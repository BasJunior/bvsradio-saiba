"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
import {
  GA4_CONSENT_KEY,
  GA4_MEASUREMENT_ID,
  hasDoNotTrack,
  isGa4MeasurementId,
  isPublicWebHost,
  shouldSkipGa4,
  type Ga4Consent,
} from "@/lib/ga4-web";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readConsent(): Ga4Consent | null {
  try {
    const value = window.localStorage.getItem(GA4_CONSENT_KEY);
    if (value === "granted" || value === "denied") return value;
  } catch {
    /* private mode */
  }
  return null;
}

export default function Ga4WebTag() {
  const pathname = usePathname() || "/";
  const { isNative } = useAppSurface();
  const [ready, setReady] = useState(false);
  const [webHost, setWebHost] = useState(false);
  const [dnt, setDnt] = useState(false);
  const [consent, setConsent] = useState<Ga4Consent | null>(null);
  const skip = shouldSkipGa4({ isNative, pathname });
  const measurementId = isGa4MeasurementId(GA4_MEASUREMENT_ID) ? GA4_MEASUREMENT_ID : "";
  const initialPageViewSent = useRef(false);

  useEffect(() => {
    setWebHost(isPublicWebHost(window.location.hostname));
    setDnt(hasDoNotTrack(navigator, window as { doNotTrack?: string | null }));
    setConsent(readConsent());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || skip || !webHost || dnt || consent !== "granted") return;
    if (typeof window.gtag !== "function") return;
    if (!initialPageViewSent.current) {
      initialPageViewSent.current = true;
      return;
    }
    window.gtag("event", "page_view", { page_path: pathname });
  }, [consent, dnt, pathname, ready, skip, webHost]);

  if (!ready || skip || !webHost || !measurementId || dnt) return null;

  function choose(next: Ga4Consent) {
    try {
      window.localStorage.setItem(GA4_CONSENT_KEY, next);
    } catch {
      /* ignore */
    }
    setConsent(next);
  }

  return (
    <>
      {consent === "granted" ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
          <Script id="bvs-ga4-web" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                analytics_storage: 'granted',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
              gtag('js', new Date());
              gtag('config', '${measurementId}', {
                anonymize_ip: true,
                allow_google_signals: false,
                allow_ad_personalization_signals: false
              });
            `}
          </Script>
        </>
      ) : null}

      {consent == null ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[5.75rem] z-[70] px-3 md:bottom-24">
          <div className="pointer-events-auto mx-auto max-w-xl rounded-2xl border border-white/15 bg-[#111]/95 px-4 py-3 text-sm text-text-primary shadow-2xl backdrop-blur">
            <p className="text-[13px] leading-snug text-text-secondary">
              BVS uses website analytics to see what helps the station grow. Not used in the app.{" "}
              <Link href="/privacy" className="text-brand underline-offset-2 hover:underline">
                Privacy
              </Link>
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
                No thanks
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
