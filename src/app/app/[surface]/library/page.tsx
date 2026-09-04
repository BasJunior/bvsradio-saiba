import { notFound } from "next/navigation";
import LibraryView from "@/components/library/LibraryView";
import { AppLibraryEditionBoundary } from "@/components/app-vnext/AppLibraryEdition";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppLibraryPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return (
    <AppLibraryEditionBoundary surface={surface as AppSurface} fallback={<LibraryView />} />
  );
}
