export type AppLinkSurface = "ios" | "android";

const BVS_HOSTS = new Set(["bvsradio.com", "www.bvsradio.com"]);

function withQueryAndHash(pathname: string, search: string, hash: string) {
  return `${pathname}${search}${hash}`;
}

function marketplaceRoute(pathname: string, root: string, search: string, hash: string) {
  const params = new URLSearchParams(search);
  if (pathname === "/shop") {
    if (!params.has("provider")) params.set("provider", "bvs-studio-services");
    const suffix = params.toString();
    return `${root}/marketplace${suffix ? `?${suffix}` : ""}${hash}`;
  }
  if (pathname === "/marketplace") return withQueryAndHash(`${root}/marketplace`, search, hash);
  const match = pathname.match(/^\/marketplace\/([^/]+)(?:\/(book))?$/);
  if (!match?.[1]) return null;
  params.set("provider", decodeURIComponent(match[1]));
  if (match[2] === "book") params.set("book", "1");
  const suffix = params.toString();
  return `${root}/marketplace${suffix ? `?${suffix}` : ""}${hash}`;
}

function legacyRoute(pathname: string, surface: AppLinkSurface, search: string, hash: string) {
  const root = `/app/${surface}`;
  if (pathname === "/" || pathname === "/radio" || pathname.startsWith("/radio/") || pathname === "/listen" || pathname.startsWith("/listen/")) {
    return withQueryAndHash(root, search, hash);
  }
  if (pathname === "/library") return withQueryAndHash(`${root}/library`, search, hash);
  if (pathname === "/notifications") return withQueryAndHash(`${root}/notifications`, search, hash);
  if (pathname === "/account") return withQueryAndHash(`${root}/account`, search, hash);
  if (pathname.startsWith("/account/orders/")) return withQueryAndHash(`${root}/studio/orders`, search, hash);
  if (pathname === "/contact" || pathname === "/support") return withQueryAndHash(`${root}/support`, search, hash);
  if (pathname === "/search" || pathname === "/catalogue") return withQueryAndHash(`${root}/explore`, search, hash);
  if (pathname === "/upload" || pathname === "/distribution") return withQueryAndHash(`${root}/studio/release`, search, hash);
  if (pathname === "/creator/studio" || pathname === "/creator/studio/manage") return withQueryAndHash(`${root}/studio`, search, hash);
  if (pathname.startsWith("/creator/studio/orders")) return withQueryAndHash(`${root}/studio/orders`, search, hash);
  if (pathname.startsWith("/creator/studio/marketplace") || pathname === "/creator/marketplace") return withQueryAndHash(`${root}/studio/marketplace`, search, hash);
  if (pathname.startsWith("/creator/studio/insights")) return withQueryAndHash(`${root}/studio/insights`, search, hash);
  if (pathname === "/artists" || pathname === "/artist/premium" || pathname === "/producer/premium") return withQueryAndHash(`${root}/studio/money`, search, hash);
  if (pathname.startsWith("/marketplace/orders")) return withQueryAndHash(`${root}/studio/orders`, search, hash);
  if (pathname === "/shop" || pathname === "/marketplace" || pathname.startsWith("/marketplace/")) {
    const destination = marketplaceRoute(pathname, root, search, hash);
    if (destination) return destination;
  }

  const roomMatch = pathname.match(/^\/rooms\/([^/]+)$/);
  if (roomMatch?.[1]) return withQueryAndHash(`${root}/rooms/${roomMatch[1]}`, search, hash);
  const communityRoomMatch = pathname.match(/^\/community\/rooms\/([^/]+)$/);
  if (communityRoomMatch?.[1]) return withQueryAndHash(`${root}/rooms/${communityRoomMatch[1]}`, search, hash);
  if (pathname === "/community" || pathname === "/community/rooms" || pathname === "/rooms") return withQueryAndHash(`${root}/rooms`, search, hash);

  const artistMatch = pathname.match(/^\/artist\/([^/]+)$/);
  if (artistMatch?.[1]) return withQueryAndHash(`${root}/creator/${artistMatch[1]}`, search, hash);
  const showMatch = pathname.match(/^\/shows\/([^/]+)$/);
  if (showMatch?.[1]) return withQueryAndHash(`${root}/show/${showMatch[1]}`, search, hash);

  return null;
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
    const suffix = parts.slice(2);
    const legacy = legacyRoute(`/${suffix.join("/")}`, surface, url.search, url.hash);
    if (legacy) return legacy;
    return withQueryAndHash(`/app/${surface}${suffix.length ? `/${suffix.join("/")}` : ""}`, url.search, url.hash);
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    const suffix = parts[0] === "app" ? parts.slice(1) : [];
    const legacy = legacyRoute(`/${suffix.join("/")}`, surface, url.search, url.hash);
    if (legacy) return legacy;
    return withQueryAndHash(`/app/${surface}${suffix.length ? `/${suffix.join("/")}` : ""}`, url.search, url.hash);
  }

  const mapped = legacyRoute(pathname, surface, url.search, url.hash);
  return mapped || `/app/${surface}`;
}
