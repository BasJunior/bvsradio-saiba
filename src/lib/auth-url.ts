/**
 * Canonical site URL for auth emails and OAuth redirects.
 * Always prefer production (bvsradio.com) for confirmation emails so links
 * never bind to localhost — even if someone signed up from a local/preview
 * origin or SITE_URL was mis-set to localhost.
 */
function isLocalHost(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}

export function getSiteUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  // Production build: never emit localhost redirects into confirmation emails.
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production" || process.env.VERCEL_ENV === "production") {
    if (fromEnv && !isLocalHost(fromEnv)) return fromEnv;
    return "https://bvsradio.com";
  }
  if (fromEnv && !isLocalHost(fromEnv)) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, "");
    // On real site, prefer live origin over a stale localhost env.
    if (!isLocalHost(origin)) return origin;
  }
  // Local dev only — still point emails at production so inbox links work
  // for real addresses. Use Supabase redirect allowlist for localhost if needed.
  return "https://bvsradio.com";
}

export function getAuthCallbackUrl(path = "/auth/confirmed"): string {
  const base = getSiteUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
