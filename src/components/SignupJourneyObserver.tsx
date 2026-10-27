"use client";

import { useEffect } from "react";
import { trackSignupFunnel } from "@/lib/signup-funnel";

function isSignupDestination(url: URL) {
  return url.pathname === "/auth/signup" || /^\/app\/(ios|android)\/join(?:\/|$)/.test(url.pathname);
}

export default function SignupJourneyObserver() {
  useEffect(() => {
    const captureSignupClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;

      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin || !isSignupDestination(url)) return;

      trackSignupFunnel("join_cta_clicked", {
        source: target.dataset.signupSource || window.location.pathname || "unknown",
        destination: url.pathname,
      });
    };

    document.addEventListener("click", captureSignupClick, true);
    return () => document.removeEventListener("click", captureSignupClick, true);
  }, []);

  return null;
}
