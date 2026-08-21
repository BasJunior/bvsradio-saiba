"use client";

import { Capacitor } from "@capacitor/core";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const IOS_ROOT = "/app/ios";

function isAllowedIosPath(pathname: string) {
  return pathname === IOS_ROOT || pathname.startsWith(`${IOS_ROOT}/`);
}

function containedLegacyPath(url: URL) {
  if (url.pathname === "/account") return `${IOS_ROOT}/account${url.search}${url.hash}`;
  if (url.pathname === "/artists" || url.pathname === "/music/artists") return `${IOS_ROOT}/artists${url.search}${url.hash}`;
  return null;
}

function openOutsideNativeShell(url: URL) {
  const opened = window.open(url.toString(), "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

/**
 * App Store boundary for the native iOS listener edition.
 *
 * Native iOS is allowed to navigate only within /app/ios/*. A small set of
 * legacy listener links are remapped into contained app routes. Other BVS
 * website destinations are opened outside the native listener surface. Any
 * non-approved route reached by another mechanism fails closed to /app/ios.
 */
export default function MobileIosBoundary() {
  const pathname = usePathname();

  useEffect(() => {
    const nativeIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
    if (!nativeIos) return;

    if (!isAllowedIosPath(pathname)) {
      window.location.replace(IOS_ROOT);
      return;
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const rawHref = anchor.getAttribute("href") || "";
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol)) return;

      const sameOrigin = url.origin === window.location.origin;
      const allowed = sameOrigin && isAllowedIosPath(url.pathname);
      if (allowed) return;

      const contained = sameOrigin ? containedLegacyPath(url) : null;
      event.preventDefault();
      event.stopPropagation();
      if (contained) {
        window.location.assign(contained);
        return;
      }
      openOutsideNativeShell(url);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  return null;
}
