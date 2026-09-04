import type { AppLinkSurface } from "@/lib/app-link-routing";

export type AppTelemetryEvent =
  | "app_open"
  | "app_resume"
  | "app_background"
  | "deep_link_open"
  | "push_open"
  | "network_change"
  | "offline_download_start"
  | "offline_download_success"
  | "offline_download_failure"
  | "offline_download_remove"
  | "offline_download_renew"
  | "offline_playback_start"
  | "offline_playback_failure";

export function emitAppTelemetry(
  event: AppTelemetryEvent,
  surface: AppLinkSurface,
  meta: Record<string, string | boolean | number | undefined> = {},
) {
  if (typeof window === "undefined") return;
  const compact = Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined));
  void fetch("/api/app/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, surface, meta: compact }),
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}
