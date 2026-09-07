import AppAccountClient from "@/components/app-vnext/AppAccountClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppAccountPage({ params }: { params: Promise<{ surface: string }> }) {
  const surface = (await params).surface as AppSurface;
  return <AppAccountClient surface={surface} />;
}
