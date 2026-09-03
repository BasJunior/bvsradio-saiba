import { notFound } from "next/navigation";
import AppBootstrap, { type AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppBottomNav from "@/components/app-vnext/AppBottomNav";
import AppNativeRuntime from "@/components/app-vnext/AppNativeRuntime";
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
      <AppNativeRuntime surface={surface} />
      <style>{`
        html[data-bvs-app-shell="true"] footer { display: none !important; }
        html[data-bvs-app-shell="true"] body { overscroll-behavior-y: none; }
        html[data-bvs-app-shell="true"] [aria-label="Install BVS Radio"] { display: none !important; }
        html[data-bvs-network="offline"] [data-bvs-network-dependent="true"] { opacity: .58; }
      `}</style>
      <AppTopBar surface={surface} />
      <div className="min-h-[calc(100dvh-4rem)] pb-4">{children}</div>
      <AppBottomNav surface={surface} />
    </AppSessionProvider>
  );
}
