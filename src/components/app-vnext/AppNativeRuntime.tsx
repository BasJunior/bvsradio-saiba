"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { appRouteForNativeUrl } from "@/lib/app-link-routing";
import { getNetworkStatus, isNativeRuntime, listenNetworkStatus, listenPushNotificationActions } from "@/lib/app-native";
import { emitAppTelemetry } from "@/lib/app-telemetry";

export default function AppNativeRuntime({ surface }: { surface: AppSurface }) {
  const router = useRouter();

  useEffect(() => {
    let stopNetwork: (() => Promise<void>) | null = null;
    let stopAppUrl: (() => Promise<void>) | null = null;
    let stopPushActions: (() => Promise<void>) | null = null;
    let alive = true;

    const routeNativeUrl = (raw: string, source: "link" | "push") => {
      const target = appRouteForNativeUrl(raw, surface, window.location.hostname);
      if (!target) return;
      emitAppTelemetry(source === "push" ? "push_open" : "deep_link_open", surface, { route: target.split(/[?#]/)[0] });
      window.dispatchEvent(new CustomEvent("bvs:app-entry", { detail: { source, target } }));
      router.push(target);
    };

    const applyNetwork = (status: { connected: boolean; connectionType: string }) => {
      document.documentElement.dataset.bvsNetwork = status.connected ? status.connectionType || "online" : "offline";
      emitAppTelemetry("network_change", surface, { connected: status.connected, connectionType: status.connectionType });
      window.dispatchEvent(new CustomEvent("bvs:network-status", { detail: status }));
    };

    emitAppTelemetry("app_open", surface);
    void getNetworkStatus().then((status) => alive && applyNetwork(status));
    void listenNetworkStatus(applyNetwork).then((stop) => { if (alive) stopNetwork = stop; else void stop(); });

    if (isNativeRuntime()) {
      void App.addListener("appUrlOpen", ({ url }) => routeNativeUrl(url, "link")).then((handle) => {
        if (alive) stopAppUrl = () => handle.remove(); else void handle.remove();
      });
      void App.getLaunchUrl().then((launch) => {
        if (alive && launch?.url) routeNativeUrl(launch.url, "link");
      }).catch(() => undefined);
      void listenPushNotificationActions((action) => {
        const data = action.notification?.data || {};
        const raw = typeof data.href === "string" ? data.href : typeof data.url === "string" ? data.url : "";
        if (raw) routeNativeUrl(raw, "push");
      }).then((stop) => { if (alive) stopPushActions = stop; else void stop(); });
      window.dispatchEvent(new CustomEvent("bvs:native-runtime", { detail: { surface, native: true } }));
    }

    return () => {
      alive = false;
      void stopNetwork?.();
      void stopAppUrl?.();
      void stopPushActions?.();
    };
  }, [router, surface]);
  return null;
}
