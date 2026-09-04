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

function marketplaceRoute(surface: AppSurface, url: URL) {
  const base = `/app/${surface}/marketplace`;
  if (url.pathname === "/shop") {
    const params = new URLSearchParams(url.searchParams);
    if (!params.has("provider")) params.set("provider", "bvs-studio-services");
    return `${base}?${params.toString()}`;
  }
  if (url.pathname === "/marketplace") return `${base}${url.search}`;
  const match = url.pathname.match(/^\/marketplace\/([^/]+)(?:\/(book))?$/);
  if (!match?.[1]) return null;
  const params = new URLSearchParams(url.searchParams);
  params.set("provider", decodeURIComponent(match[1]));
  if (match[2] === "book") params.set("book", "1");
  return `${base}?${params.toString()}`;
}

export function appDestination(surface: AppSurface, url: URL) {
  const path = url.pathname;
  if (path.startsWith(`/app/${surface}`)) return null;
  if (path === "/contact") return `/app/${surface}/support${url.search}`;
  if (path === "/search" || path === "/catalogue") return exploreRoute(surface, url);
  if (path === "/radio" || path === "/") return `/app/${surface}`;
  if (path === "/library") return `/app/${surface}/library`;
  if (path === "/notifications") return `/app/${surface}/notifications`;
  if (path === "/account") return `/app/${surface}/account`;
  if (path.startsWith("/account/orders/")) return `/app/${surface}/studio/orders`;
  if (path === "/upload" || path === "/distribution") return `/app/${surface}/studio/release`;
  if (path === "/creator/marketplace" || path.startsWith("/creator/studio/marketplace")) return `/app/${surface}/studio/marketplace`;
  if (path === "/marketplace/orders" || path.startsWith("/marketplace/orders/")) return `/app/${surface}/studio/orders`;
  if (path === "/shop" || path === "/marketplace" || path.startsWith("/marketplace/")) {
    const destination = marketplaceRoute(surface, url);
    if (destination) return destination;
  }
  if (path === "/creator/studio" || path === "/creator/studio/manage") return `/app/${surface}/studio`;
  if (path.startsWith("/creator/studio/orders")) return `/app/${surface}/studio/orders`;
  if (path.startsWith("/creator/studio/insights")) return `/app/${surface}/studio/insights`;
  if (path === "/artists" || path === "/artist/premium" || path === "/producer/premium") return `/app/${surface}/studio/money`;

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
      window.localStorage.setItem("bvs_app_version", "1.1");
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
    window.dispatchEvent(new CustomEvent("bvs:app-shell-ready", { detail: { surface, version: "1.1" } }));
    return () => {
      document.removeEventListener("click", guardNavigation, true);
      delete root.dataset.bvsAppShell;
      delete root.dataset.bvsAppSurface;
    };
  }, [router, surface]);
  return null;
}
