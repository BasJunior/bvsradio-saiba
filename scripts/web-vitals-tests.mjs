import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const reporter = await readFile(new URL("../src/components/WebVitalsReporter.tsx", import.meta.url), "utf8");
const analytics = await readFile(new URL("../src/lib/analytics.ts", import.meta.url), "utf8");
const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/api/analytics/route.ts", import.meta.url), "utf8");

assert.ok(
  reporter.includes('useReportWebVitals') &&
    reporter.includes('from "next/web-vitals"'),
  "BVS must use Next's App Router Web Vitals hook.",
);

for (const metric of ["LCP", "INP", "CLS", "FCP", "TTFB"]) {
  assert.ok(reporter.includes(`"${metric}"`), `Reporter must retain ${metric}.`);
}
assert.ok(
  !reporter.includes('"FID"'),
  "Reporter should use INP rather than legacy FID.",
);

assert.ok(
  reporter.includes('trackEvent("web_vital"') &&
    reporter.includes("rating: metric.rating") &&
    reporter.includes("navigation_type: metric.navigationType"),
  "Vitals must use existing BVS analytics with rating and navigation context.",
);
assert.ok(
  reporter.includes("surfaceForPath") &&
    reporter.includes("viewportBucket") &&
    reporter.includes("display_mode") &&
    reporter.includes("effective_type") &&
    reporter.includes("save_data") &&
    reporter.includes("visibility"),
  "Vitals must include coarse surface, viewport, display-mode and network context for mobile diagnosis.",
);
assert.ok(
  reporter.includes('return "ios"') &&
    reporter.includes('return "android"') &&
    reporter.includes('return "web"') &&
    reporter.includes('return "phone-small"') &&
    reporter.includes('return "phone"') &&
    reporter.includes('return "tablet"') &&
    reporter.includes('return "desktop"'),
  "Vitals context must use coarse buckets rather than exact device identifiers.",
);
assert.ok(
  analytics.includes('"web_vital"'),
  "web_vital must remain in the central analytics event contract.",
);
assert.ok(
  route.includes("new Set<string>(analyticsEvents)"),
  "Analytics API must continue deriving allowed events from the central contract.",
);
assert.ok(
  layout.includes("<WebVitalsReporter />") &&
    layout.indexOf("<AnalyticsBootstrap />") < layout.indexOf("<WebVitalsReporter />"),
  "Web Vitals reporter must mount after analytics identity bootstrap.",
);

console.log("web vitals gates passed");
