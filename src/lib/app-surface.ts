export type AppSurface = "ios" | "android";

export const APP_SURFACE_STORAGE_KEY = "bvs.app.surface";
export const APP_SESSION_STORAGE_KEY = "bvs.app.in_session";

const WORKSPACE_PREFIXES = ["/editorial", "/admin", "/creator"];

const LISTENER_CONTINUATION_PREFIXES = [
  "/account",
  "/artist",
  "/album",
  "/blog",
  "/articles",
  "/catalogue",
  "/search",
  "/library",
  "/shows",
  "/radio",
  "/contact",
  "/privacy",
  "/terms",
  "/refunds",
  "/auth",
  "/notifications",
  "/checkout",
  "/shop",
  "/marketplace",
  "/faq",
  "/about",
  "/premium",
  "/artist/premium",
];

export function parseSurfaceFromPath(pathname: string): AppSurface | null {
  const match = pathname.match(/^\/app\/(ios|android)(?:\/|$)/);
  return match?.[1] === "android" || match?.[1] === "ios" ? match[1] : null;
}

export function isWorkspacePath(pathname: string) {
  return WORKSPACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isListenerContinuation(pathname: string) {
  if (parseSurfaceFromPath(pathname)) return true;
  return LISTENER_CONTINUATION_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function appHome(surface: AppSurface) {
  return `/app/${surface}`;
}

export function appExplore(surface: AppSurface, query?: string) {
  const path = `/app/${surface}/explore`;
  return query?.trim() ? `${path}?q=${encodeURIComponent(query.trim())}` : path;
}

export function appBeats(surface: AppSurface) {
  return `/app/${surface}/beats`;
}

export function appLibrary(surface: AppSurface) {
  return `/app/${surface}/library`;
}

export function hrefForAppSurface(href: string, surface: AppSurface | null | undefined) {
  if (!surface || !href.startsWith("/")) return href;
  if (href.startsWith("/app/")) return href;
  const [withoutHash, hash = ""] = href.split("#");
  const [path, search = ""] = withoutHash.split("?");
  const query = search ? `?${search}` : "";
  if (path === "/" || path === "") return appHome(surface);
  if (path === "/search") return `${appExplore(surface)}${query}`;
  if (path === "/library") return appLibrary(surface);
  if (path === "/catalogue" && /(?:^|&)type=beat(?:&|#|$)/.test(search)) return appBeats(surface);
  if (path === "/radio") return `${appHome(surface)}#listen`;
  return hash ? `${path}${query}#${hash}` : href;
}

export function resolveAppChrome(
  pathname: string,
  opts: {
    nativeSurface?: AppSurface | null;
    storedSurface?: AppSurface | null;
    inSession?: boolean;
  } = {},
): { surface: AppSurface | null; appChrome: boolean } {
  const pathSurface = parseSurfaceFromPath(pathname);
  const nativeSurface = opts.nativeSurface || null;
  const storedSurface = opts.storedSurface || null;
  const surface = pathSurface || nativeSurface || (opts.inSession ? storedSurface : null);

  if (isWorkspacePath(pathname)) {
    return { surface, appChrome: false };
  }
  if (pathSurface) {
    return { surface: pathSurface, appChrome: true };
  }
  if (nativeSurface) {
    return { surface: nativeSurface, appChrome: true };
  }
  if (opts.inSession && storedSurface && isListenerContinuation(pathname)) {
    return { surface: storedSurface, appChrome: true };
  }
  return { surface: pathSurface, appChrome: false };
}

export function primaryAppDestinations(surface: AppSurface | null) {
  if (surface) {
    return [
      { href: appHome(surface), label: "Home", id: "home" as const },
      { href: appExplore(surface), label: "Explore", id: "explore" as const },
      { href: appBeats(surface), label: "Beats", id: "beats" as const },
      { href: appLibrary(surface), label: "Library", id: "library" as const },
    ];
  }
  return [
    { href: "/", label: "Home", id: "home" as const },
    { href: "/search", label: "Explore", id: "explore" as const },
    { href: "/catalogue?type=beat#beatstore", label: "Beats", id: "beats" as const },
    { href: "/library", label: "Library", id: "library" as const },
  ];
}

export function matchPrimaryDestination(
  id: "home" | "explore" | "beats" | "library",
  pathname: string,
  search = "",
) {
  const surface = parseSurfaceFromPath(pathname);
  if (surface) {
    if (id === "home") return pathname === appHome(surface);
    if (id === "explore") return pathname === appExplore(surface) || pathname.startsWith(`${appExplore(surface)}/`);
    if (id === "beats") return pathname === appBeats(surface);
    return pathname === appLibrary(surface);
  }
  if (id === "home") return pathname === "/";
  if (id === "beats") return pathname.startsWith("/catalogue") && /(?:^|&)type=beat(?:&|#|$)/.test(search.replace(/^\?/, ""));
  if (id === "library") return pathname.startsWith("/library");
  return (
    pathname === "/search" ||
    pathname.startsWith("/search/") ||
    pathname.startsWith("/artist") ||
    pathname.startsWith("/music") ||
    pathname.startsWith("/shows") ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/articles") ||
    pathname.startsWith("/album") ||
    (pathname.startsWith("/catalogue") && !/(?:^|&)type=beat(?:&|#|$)/.test(search.replace(/^\?/, "")))
  );
}
