"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppBootstrap, { type AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppBottomNav from "@/components/app-vnext/AppBottomNav";
import AppDataModeBridge from "@/components/app-vnext/AppDataModeBridge";
import AppGestureBridge from "@/components/app-vnext/AppGestureBridge";
import AppLibrarySyncBridge from "@/components/app-vnext/AppLibrarySyncBridge";
import AppNativeRuntime from "@/components/app-vnext/AppNativeRuntime";
import AppStationFetchBridge from "@/components/app-vnext/AppStationFetchBridge";
import AppTopBar from "@/components/app-vnext/AppTopBar";
import { AppSessionProvider } from "@/components/app-vnext/AppSessionProvider";
import { getNativeAppInfo, isAppStoreVnextVersion, isNativeRuntime } from "@/lib/app-native";

function useVnextEdition() {
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const preview = searchParams.get("appShell") === "vnext" || searchParams.get("appShell") === "1.1";
    if (preview) {
      setEnabled(true);
      return;
    }
    if (!isNativeRuntime()) {
      setEnabled(false);
      return;
    }
    void getNativeAppInfo().then((info) => {
      setEnabled(isAppStoreVnextVersion(info?.version));
    });
  }, [searchParams]);

  return enabled;
}

export default function AppEditionShell({
  surface,
  children,
}: {
  surface: AppSurface;
  children: React.ReactNode;
}) {
  const vnext = useVnextEdition();
  if (!vnext) return children;

  return (
    <AppSessionProvider>
      <AppBootstrap surface={surface} />
      <AppNativeRuntime surface={surface} />
      <AppDataModeBridge surface={surface} />
      <AppLibrarySyncBridge />
      <AppStationFetchBridge />
      <AppGestureBridge surface={surface} />
      <style>{`
        html[data-bvs-app-shell="true"] footer { display: none !important; }
        html[data-bvs-app-shell="true"] body { overscroll-behavior-y: none; }
        html[data-bvs-app-shell="true"] [aria-label="Install BVS Radio"] { display: none !important; }
        html[data-bvs-network="offline"] [data-bvs-network-dependent="true"] { opacity: .58; }
        html[data-bvs-data-effective="saver"] [data-bvs-data-heavy="true"] { display: none !important; }
      `}</style>
      <AppTopBar surface={surface} />
      <div className="min-h-[calc(100dvh-4rem)] pb-4">{children}</div>
      <AppBottomNav surface={surface} />
    </AppSessionProvider>
  );
}
