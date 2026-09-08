export const BVS_PUBLIC_ORIGIN = "https://bvsradio.com";

function publicPath(pathname: string) {
  const match = pathname.match(/^\/app\/(ios|android)(\/.*)?$/i);
  if (!match) return pathname || "/";
  const rest = match[2] || "";
  const segments = rest.split("/").filter(Boolean);
  const [section, ...tail] = segments;
  if (section === "beat" && tail.length) return `/beat/${tail.join("/")}`;
  if (section === "creator" && tail.length) return `/artist/${tail.join("/")}`;
  if (section === "show" && tail.length) return `/shows/${tail.join("/")}`;
  if (section === "playlist" && tail.length) return `/playlist/${tail.join("/")}`;
  if (section === "marketplace") return `/marketplace${tail.length ? `/${tail.join("/")}` : ""}`;
  if (section === "explore") return "/search";
  return rest || "/";
}

/**
 * Sharing must always leave BVS with a stable public URL. Preview hosts, native
 * WebView origins and local development hosts are intentionally discarded.
 * Known contained-app routes are converted to their public web equivalents.
 */
export function canonicalBvsShareUrl(pathOrUrl: string) {
  const raw = String(pathOrUrl || "/").trim() || "/";
  try {
    const parsed = new URL(raw, BVS_PUBLIC_ORIGIN);
    const pathname = publicPath(parsed.pathname);
    return new URL(`${pathname}${parsed.search}${parsed.hash}`, BVS_PUBLIC_ORIGIN).href;
  } catch {
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${BVS_PUBLIC_ORIGIN}${publicPath(path)}`;
  }
}
