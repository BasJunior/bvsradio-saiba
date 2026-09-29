"use client";

import { useReportWebVitals } from "next/web-vitals";
import { trackEvent } from "@/lib/analytics";

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
    });
  });

  return null;
}
