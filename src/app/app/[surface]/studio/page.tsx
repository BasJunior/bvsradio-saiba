import { notFound } from "next/navigation";
import AppStudioClient from "@/components/app-vnext/AppStudioClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppStudioPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  return <AppStudioClient surface={raw as AppSurface} />;
}
