import { notFound } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppSongWorkspaceClient from "@/components/app-vnext/AppSongWorkspaceClient";

export default async function AppSongWorkspacePage({ params }: { params: Promise<{ surface: string; id: string }> }) {
  const { surface, id } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <AppSongWorkspaceClient id={id} surface={surface as AppSurface} />;
}
