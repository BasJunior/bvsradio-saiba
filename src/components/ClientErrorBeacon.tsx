"use client";

import { useEffect } from "react";

/**
 * Sampled client error beacon for silent bug discovery.
 * Does NOT emit playback_error — that metric is reserved for real audio failures
 * in StationPlayer so sales/listen scoreboards stay honest.
 */
export default function ClientErrorBeacon() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (Math.random() > 0.08) return;
      // Keep payload out of analytics_events until a dedicated client_error event exists.
      if (process.env.NODE_ENV !== "production") {
        console.debug("[bvs-client-error]", String(event.message || "error").slice(0, 160));
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (Math.random() > 0.08) return;
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "rejection");
      if (process.env.NODE_ENV !== "production") {
        console.debug("[bvs-client-rejection]", reason.slice(0, 160));
      }
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
