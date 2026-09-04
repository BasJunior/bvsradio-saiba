"use client";

import AppBootstrap, { type AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppBottomNav from "@/components/app-vnext/AppBottomNav";
import AppDataModeBridge from "@/components/app-vnext/AppDataModeBridge";
import AppGestureBridge from "@/components/app-vnext/AppGestureBridge";
import AppLibrarySyncBridge from "@/components/app-vnext/AppLibrarySyncBridge";
import AppNativeRuntime from "@/components/app-vnext/AppNativeRuntime";
import AppStationFetchBridge from "@/components/app-vnext/AppStationFetchBridge";
import AppTopBar from "@/components/app-vnext/AppTopBar";
import { AppSessionProvider } from "@/components/app-vnext/AppSessionProvider";
import { useVnextEdition } from "@/components/app-vnext/useVnextEdition";

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
        html[data-bvs-app-shell="true"] footer,
        html[data-bvs-app-shell="true"] [data-bvs-web-app-header],
        html[data-bvs-app-shell="true"] [data-bvs-web-app-nav],
        html[data-bvs-app-shell="true"] [aria-label="Install BVS Radio"],
        html[data-bvs-app-shell="true"] [data-bvs-web-extra] {
          display: none !important;
        }
        html[data-bvs-app-shell="true"] body { overscroll-behavior-y: none; }
        html[data-bvs-network="offline"] [data-bvs-network-dependent="true"] { opacity: .58; }
        html[data-bvs-data-effective="saver"] [data-bvs-data-heavy="true"] { display: none !important; }
        html[data-bvs-network="offline"] [data-bvs-offline-banner] { display: block !important; }
      `}</style>
      <p
        data-bvs-offline-banner
        className="fixed inset-x-0 z-[61] hidden bg-amber-300 px-4 py-1.5 text-center text-xs font-semibold text-black"
        style={{ top: "var(--bvs-app-header-height)" }}
        role="status"
      >
        You’re offline. Cleared downloads stay available in Library.
      </p>
      <AppTopBar surface={surface} />
      <div className="pb-4">{children}</div>
      <AppBottomNav surface={surface} />
    </AppSessionProvider>
  );
}
