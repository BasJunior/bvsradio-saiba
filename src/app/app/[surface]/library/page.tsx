import { notFound } from "next/navigation";
import AppLibraryClient from "@/components/app-vnext/AppLibraryClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppLibraryPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  return <AppLibraryClient surface={raw as AppSurface} />;
}
