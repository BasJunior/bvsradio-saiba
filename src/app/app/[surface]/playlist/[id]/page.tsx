import { notFound } from "next/navigation";
import AppPlaylistDetailClient from "@/components/app-vnext/AppPlaylistDetailClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppPlaylistPage({ params }: { params: Promise<{ surface: string; id: string }> }) {
  const { surface, id } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  if (!id) notFound();
  return <AppPlaylistDetailClient surface={surface as AppSurface} playlistId={id} />;
}
