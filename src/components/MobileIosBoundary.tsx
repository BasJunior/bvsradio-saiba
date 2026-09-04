"use client";

import { Capacitor } from "@capacitor/core";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getNativeAppInfo, isAppStoreVnextVersion } from "@/lib/app-native";
import { isAllowedIosPathname, type IosAppEdition } from "@/lib/ios-surface-lock";

const IOS_ROOT = "/app/ios";

function containedLegacyPath(url: URL, edition: IosAppEdition) {
  if (url.pathname === "/account") return `${IOS_ROOT}/account${url.search}${url.hash}`;
  if (url.pathname === "/artists" || url.pathname === "/music/artists") return `${IOS_ROOT}/artists${url.search}${url.hash}`;
  if (edition === "1.1") {
    if (url.pathname === "/auth/login" || url.pathname === "/auth/signup") {
      return `${IOS_ROOT}/join${url.search}${url.hash}`;
    }
    if (url.pathname === "/notifications") return `${IOS_ROOT}/notifications${url.search}${url.hash}`;
    if (url.pathname === "/contact") return `${IOS_ROOT}/support${url.search}${url.hash}`;
  }
  return null;
}

function openOutsideNativeShell(url: URL) {
  const opened = window.open(url.toString(), "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

/**
 * App Store boundary for the native iOS edition.
 *
 * 1.0 binaries stay on the approved listener paths. 1.1 binaries may use the
 * deliberate vNext routes. Other website destinations open outside the shell.
 */
export default function MobileIosBoundary() {
  const pathname = usePathname();

  useEffect(() => {
    const nativeIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
    if (!nativeIos) return;
    let cancelled = false;
    let edition: IosAppEdition = "1.0";

    const apply = () => {
      if (cancelled) return;
      if (!isAllowedIosPathname(pathname, edition)) {
        window.location.replace(IOS_ROOT);
      }
    };

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
      const allowed = sameOrigin && isAllowedIosPathname(url.pathname, edition);
      if (allowed) return;

      const contained = sameOrigin ? containedLegacyPath(url, edition) : null;
      event.preventDefault();
      event.stopPropagation();
      if (contained) {
        window.location.assign(contained);
        return;
      }
      openOutsideNativeShell(url);
    };

    document.addEventListener("click", onClick, true);
    void getNativeAppInfo().then((info) => {
      if (cancelled) return;
      edition = isAppStoreVnextVersion(info?.version) ? "1.1" : "1.0";
      apply();
    });
    apply();

    return () => {
      cancelled = true;
      document.removeEventListener("click", onClick, true);
    };
  }, [pathname]);

  return null;
}
