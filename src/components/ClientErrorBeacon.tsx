"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/** Sampled client error / unhandled rejection beacons for silent bug discovery. */
export default function ClientErrorBeacon() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (Math.random() > 0.25) return;
      trackEvent("playback_error", {
        stage: "window_error",
        message: String(event.message || "error").slice(0, 160),
        path: window.location.pathname,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (Math.random() > 0.25) return;
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "rejection");
      trackEvent("playback_error", {
        stage: "unhandled_rejection",
        message: reason.slice(0, 160),
        path: window.location.pathname,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
