import { notFound } from "next/navigation";
import AppExploreClient from "@/components/app-vnext/AppExploreClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppExplorePage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  return <AppExploreClient surface={raw as AppSurface} />;
}
