export type AppLinkSurface = "ios" | "android";

const BVS_HOSTS = new Set(["bvsradio.com", "www.bvsradio.com"]);

function withQueryAndHash(pathname: string, search: string, hash: string) {
  return `${pathname}${search}${hash}`;
}

export function appRouteForNativeUrl(raw: string, surface: AppLinkSurface, currentHost?: string): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value, "https://bvsradio.com");
  } catch {
    return null;
  }

  let pathname = url.pathname || "/";
  if (url.protocol === "bvsradio:") {
    const customRoot = url.hostname ? `/${url.hostname}` : "";
    pathname = `${customRoot}${url.pathname || ""}` || "/";
  } else if (url.protocol === "http:" || url.protocol === "https:") {
    const host = url.hostname.toLowerCase();
    if (!BVS_HOSTS.has(host) && (!currentHost || host !== currentHost.toLowerCase())) return null;
  } else {
    return null;
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "app" && (parts[1] === "ios" || parts[1] === "android")) {
    const suffix = parts.slice(2).join("/");
    return withQueryAndHash(`/app/${surface}${suffix ? `/${suffix}` : ""}`, url.search, url.hash);
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    const suffix = parts[0] === "app" ? parts.slice(1).join("/") : "";
    return withQueryAndHash(`/app/${surface}${suffix ? `/${suffix}` : ""}`, url.search, url.hash);
  }
  if (pathname.startsWith("/radio") || pathname.startsWith("/listen")) {
    return withQueryAndHash(`/app/${surface}/radio`, url.search, url.hash);
  }
  if (pathname.startsWith("/community") || pathname.startsWith("/rooms")) {
    return withQueryAndHash(`/app/${surface}/rooms`, url.search, url.hash);
  }
  if (pathname.startsWith("/marketplace")) {
    return withQueryAndHash(`/app/${surface}/marketplace`, url.search, url.hash);
  }

  return `/app/${surface}`;
}
