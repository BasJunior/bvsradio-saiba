"use client";

import { useReportWebVitals } from "next/web-vitals";
import { trackEvent } from "@/lib/analytics";

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorWithVitalsContext = Navigator & {
  connection?: NetworkInformation;
  standalone?: boolean;
};

function surfaceForPath(pathname: string) {
  if (pathname === "/app/ios" || pathname.startsWith("/app/ios/")) return "ios";
  if (pathname === "/app/android" || pathname.startsWith("/app/android/")) return "android";
  return "web";
}

function viewportBucket(width: number) {
  if (width < 480) return "phone-small";
  if (width < 768) return "phone";
  if (width < 1024) return "tablet";
  return "desktop";
}

function vitalsContext() {
  const nav = navigator as NavigatorWithVitalsContext;
  const connection = nav.connection;
  const standalone = Boolean(
    nav.standalone ||
    window.matchMedia?.("(display-mode: standalone)")?.matches,
  );

  return {
    surface: surfaceForPath(window.location.pathname),
    viewport: viewportBucket(window.innerWidth || document.documentElement.clientWidth || 0),
    display_mode: standalone ? "standalone" : "browser",
    effective_type: String(connection?.effectiveType || "unknown").slice(0, 24),
    save_data: Boolean(connection?.saveData),
    visibility: document.visibilityState === "hidden" ? "hidden" : "visible",
  };
}

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const name = String(metric.name || "").toUpperCase();
    if (!["LCP", "INP", "CLS", "FCP", "TTFB"].includes(name)) return;

    trackEvent("web_vital", {
      metric: name,
      value: Number(metric.value.toFixed(name === "CLS" ? 4 : 1)),
      delta: Number(metric.delta.toFixed(name === "CLS" ? 4 : 1)),
      rating: metric.rating || null,
      navigation_type: metric.navigationType || null,
      metric_id: String(metric.id || "").slice(0, 80),
      ...vitalsContext(),
    });
  });

  return null;
}
