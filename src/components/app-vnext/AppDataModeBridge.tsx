"use client";

import { useEffect } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { getAppPreference, getNetworkStatus, listenNetworkStatus, type AppNetworkStatus } from "@/lib/app-native";

type DataMode = "auto" | "saver" | "high";
type EffectiveMode = "saver" | "high";

function browserSaveData() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g");
}

function resolveMode(preference: DataMode, network: AppNetworkStatus): EffectiveMode {
  if (preference === "saver") return "saver";
  if (preference === "high") return "high";
  if (!network.connected) return "saver";
  if (browserSaveData()) return "saver";
  return network.connectionType === "cellular" ? "saver" : "high";
}

export default function AppDataModeBridge({ surface }: { surface: AppSurface }) {
  useEffect(() => {
    let active = true;
    let preference: DataMode = "auto";
    let network: AppNetworkStatus = { connected: true, connectionType: "unknown" };
    let removeNetwork: (() => Promise<void>) | null = null;

    const apply = () => {
      if (!active) return;
      const effective = resolveMode(preference, network);
      const root = document.documentElement;
      root.dataset.bvsDataMode = preference;
      root.dataset.bvsDataEffective = effective;
      window.dispatchEvent(new CustomEvent("bvs:app-data-effective", {
        detail: { mode: effective, preference, connected: network.connected, connectionType: network.connectionType, surface },
      }));
    };

    const refreshPreference = async () => {
      const saved = await getAppPreference("bvs_app_data_mode");
      if (saved === "auto" || saved === "saver" || saved === "high") preference = saved;
      apply();
    };

    const onPreference = (event: Event) => {
      const next = (event as CustomEvent<{ mode?: DataMode }>).detail?.mode;
      if (next === "auto" || next === "saver" || next === "high") {
        preference = next;
        apply();
      }
    };

    void Promise.all([getNetworkStatus(), getAppPreference("bvs_app_data_mode")]).then(([status, saved]) => {
      if (!active) return;
      network = status;
      if (saved === "auto" || saved === "saver" || saved === "high") preference = saved;
      apply();
    });

    void listenNetworkStatus((status) => {
      network = status;
      apply();
    }).then((remove) => {
      if (!active) void remove();
      else removeNetwork = remove;
    });

    window.addEventListener("bvs:app-data-mode", onPreference);
    window.addEventListener("bvs:app-resume", refreshPreference);
    return () => {
      active = false;
      window.removeEventListener("bvs:app-data-mode", onPreference);
      window.removeEventListener("bvs:app-resume", refreshPreference);
      void removeNetwork?.();
      delete document.documentElement.dataset.bvsDataMode;
      delete document.documentElement.dataset.bvsDataEffective;
    };
  }, [surface]);

  return null;
}
