import AppNotificationsClient from "@/components/app-vnext/AppNotificationsClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppNotificationsPage({ params }: { params: Promise<{ surface: string }> }) {
  const surface = (await params).surface as AppSurface;
  return <AppNotificationsClient surface={surface} />;
}
