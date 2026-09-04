import { notFound } from "next/navigation";
import AppYouClient from "@/components/app-vnext/AppYouClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppYouPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  return <AppYouClient surface={raw as AppSurface} />;
}
