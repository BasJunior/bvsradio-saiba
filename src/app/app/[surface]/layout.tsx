import { notFound } from "next/navigation";
import AppBootstrap, { type AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppBottomNav from "@/components/app-vnext/AppBottomNav";
import AppTopBar from "@/components/app-vnext/AppTopBar";
import { AppSessionProvider } from "@/components/app-vnext/AppSessionProvider";

export default async function MobileVNextLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ surface: string }>;
}) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const surface = raw as AppSurface;

  return (
    <AppSessionProvider>
      <AppBootstrap surface={surface} />
      <style>{`
        html[data-bvs-app-shell="true"] footer { display: none !important; }
        html[data-bvs-app-shell="true"] section[aria-label="BVS rotation player"] {
          bottom: calc(4rem + env(safe-area-inset-bottom)) !important;
        }
        html[data-bvs-app-shell="true"] body { overscroll-behavior-y: none; }
        html[data-bvs-app-shell="true"] main { padding-bottom: calc(11rem + env(safe-area-inset-bottom)); }
        html[data-bvs-app-shell="true"] [aria-label="Install BVS Radio"] { display: none !important; }
      `}</style>
      <AppTopBar surface={surface} />
      <div className="min-h-[calc(100dvh-4rem)] pb-4">{children}</div>
      <AppBottomNav surface={surface} />
    </AppSessionProvider>
  );
}
