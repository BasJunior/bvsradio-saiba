export const GA4_MEASUREMENT_ID = "G-6KW0YW2LL2";
export const GA4_CONSENT_KEY = "bvs.ga4.consent.v1";

export type Ga4Consent = "granted" | "denied";

export function isGa4MeasurementId(id: string) {
  return /^G-[A-Z0-9]+$/.test(id);
}

export function isPublicWebHost(hostname: string) {
  const host = hostname.trim().toLowerCase();
  return host === "bvsradio.com" || host === "www.bvsradio.com";
}

export function shouldSkipGa4(opts: { isNative: boolean; pathname: string }) {
  if (opts.isNative) return true;
  const path = opts.pathname || "/";
  if (path === "/app/ios" || path.startsWith("/app/ios/")) return true;
  if (path === "/app/android" || path.startsWith("/app/android/")) return true;
  return false;
}

export function hasDoNotTrack(nav: { doNotTrack?: string | null } | null | undefined, win?: { doNotTrack?: string | null }) {
  const value = nav?.doNotTrack || win?.doNotTrack || "";
  return value === "1" || value === "yes";
}
