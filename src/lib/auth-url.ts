/**
 * Canonical site URL for auth emails and OAuth redirects.
 * Prefer production so confirmation links never point at localhost
 * when the user signed up from a preview/dev origin.
 */
export function getSiteUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, "");
    if (!/localhost|127\.0\.0\.1/.test(origin)) return origin;
  }
  return "https://bvsradio.com";
}

export function getAuthCallbackUrl(path = "/auth/confirmed"): string {
  const base = getSiteUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
