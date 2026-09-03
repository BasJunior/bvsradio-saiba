"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export type AppSurface = "ios" | "android";

function exploreRoute(surface: AppSurface, url: URL) {
  const params = new URLSearchParams();
  const q = url.searchParams.get("q");
  const mode = url.searchParams.get("mode");
  const type = url.searchParams.get("type");
  if (q) params.set("q", q);
  if (mode === "creators") params.set("kind", "artists");
  else if (mode === "producers") params.set("kind", "producers");
  else if (mode === "beats" || type === "beat") params.set("kind", "beats");
  else if (url.pathname === "/catalogue") params.set("kind", "music");
  const suffix = params.toString();
  return `/app/${surface}/explore${suffix ? `?${suffix}` : ""}`;
}

function appDestination(surface: AppSurface, url: URL) {
  const path = url.pathname;
  if (path.startsWith(`/app/${surface}`)) return null;
  if (path === "/contact") return `/app/${surface}/support${url.search}`;
  if (path === "/search" || path === "/catalogue") return exploreRoute(surface, url);
  if (path === "/radio" || path === "/") return `/app/${surface}`;
  if (path === "/library") return `/app/${surface}/library`;
  if (path === "/upload" || path === "/distribution") return `/app/${surface}/studio/release`;
  if (path === "/shop" || path === "/marketplace" || path.startsWith("/marketplace/") || path === "/creator/marketplace") return `/app/${surface}/studio/marketplace`;
  if (path === "/creator/studio" || path === "/creator/studio/manage") return `/app/${surface}/studio`;
  if (path === "/artists" || path === "/artist/premium" || path === "/producer/premium") return `/app/${surface}/studio/money`;
  if (path === "/account" || path === "/notifications") return `/app/${surface}/you`;

  const artistMatch = path.match(/^\/artist\/([^/]+)$/);
  if (artistMatch?.[1]) return `/app/${surface}/creator/${artistMatch[1]}${url.search}`;
  const showMatch = path.match(/^\/shows\/([^/]+)$/);
  if (showMatch?.[1]) return `/app/${surface}/show/${showMatch[1]}`;
  return null;
}

export default function AppBootstrap({ surface }: { surface: AppSurface }) {
  const router = useRouter();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.bvsAppShell = "true";
    root.dataset.bvsAppSurface = surface;
    try {
      window.localStorage.setItem("bvs_app_surface", surface);
      window.localStorage.setItem("bvs_app_version", "vnext");
    } catch {
      // Storage is an enhancement; never block the app shell.
    }

    const guardNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const destination = appDestination(surface, url);
      if (!destination) return;
      event.preventDefault();
      router.push(destination);
    };

    document.addEventListener("click", guardNavigation, true);
    window.dispatchEvent(new CustomEvent("bvs:app-shell-ready", { detail: { surface, version: "vnext" } }));
    return () => {
      document.removeEventListener("click", guardNavigation, true);
      delete root.dataset.bvsAppShell;
      delete root.dataset.bvsAppSurface;
    };
  }, [router, surface]);
  return null;
}
