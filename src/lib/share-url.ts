export const BVS_PUBLIC_ORIGIN = "https://bvsradio.com";

/**
 * Sharing must always leave BVS with a stable public URL. Preview hosts, native
 * WebView origins and local development hosts are intentionally discarded.
 */
export function canonicalBvsShareUrl(pathOrUrl: string) {
  const raw = String(pathOrUrl || "/").trim() || "/";
  try {
    const parsed = new URL(raw, BVS_PUBLIC_ORIGIN);
    return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, BVS_PUBLIC_ORIGIN).href;
  } catch {
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${BVS_PUBLIC_ORIGIN}${path}`;
  }
}
