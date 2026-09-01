"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { getNetworkStatus, isNativeRuntime, listenNetworkStatus } from "@/lib/app-native";

function routeNativeUrl(raw: string) {
  try {
    const url = new URL(raw);
    const currentHost = window.location.hostname;
    const allowed = url.hostname === "bvsradio.com" || url.hostname === "www.bvsradio.com" || url.hostname === currentHost;
    if (!allowed) return;
    window.location.assign(`${url.pathname}${url.search}${url.hash}` || "/");
  } catch {
    // Ignore malformed external app URLs.
  }
}

export default function AppNativeRuntime({ surface }: { surface: AppSurface }) {
  useEffect(() => {
    let stopNetwork: (() => Promise<void>) | null = null;
    let stopAppUrl: (() => Promise<void>) | null = null;
    const applyNetwork = (status: { connected: boolean; connectionType: string }) => {
      document.documentElement.dataset.bvsNetwork = status.connected ? status.connectionType || "online" : "offline";
      window.dispatchEvent(new CustomEvent("bvs:network-status", { detail: status }));
    };
    void getNetworkStatus().then(applyNetwork);
    void listenNetworkStatus(applyNetwork).then((stop) => { stopNetwork = stop; });

    if (isNativeRuntime()) {
      void App.addListener("appUrlOpen", ({ url }) => routeNativeUrl(url)).then((handle) => {
        stopAppUrl = () => handle.remove();
      });
      window.dispatchEvent(new CustomEvent("bvs:native-runtime", { detail: { surface, native: true } }));
    }

    return () => {
      void stopNetwork?.();
      void stopAppUrl?.();
    };
  }, [surface]);
  return null;
}
