"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { captureFlowScroll, restoreFlowScroll } from "@/lib/flow-session";
import { trackEvent } from "@/lib/analytics";

function currentRoute() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export default function FlowNavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const restoreOnNextRoute = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      restoreOnNextRoute.current = true;
      // Search/hash-only Back navigation does not change usePathname. Give the
      // route time to settle, then restore that state as a fallback.
      window.setTimeout(() => {
        if (!restoreOnNextRoute.current) return;
        restoreOnNextRoute.current = false;
        const route = currentRoute();
        const restored = restoreFlowScroll(route);
        if (restored) trackEvent("flow_back_restore", { route });
      }, 250);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      let destination: URL;
      try {
        destination = new URL(target.href, window.location.href);
      } catch {
        return;
      }
      if (destination.origin !== window.location.origin) return;
      const next = `${destination.pathname}${destination.search}${destination.hash}`;
      if (next === currentRoute()) return;
      const focusId = target.closest<HTMLElement>("[data-flow-focus-id]")?.dataset.flowFocusId;
      captureFlowScroll(currentRoute(), focusId);
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    if (!restoreOnNextRoute.current) return;
    restoreOnNextRoute.current = false;
    const timer = window.setTimeout(() => {
      const restored = restoreFlowScroll(currentRoute());
      if (restored) trackEvent("flow_back_restore", { route: currentRoute() });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return children;
}
