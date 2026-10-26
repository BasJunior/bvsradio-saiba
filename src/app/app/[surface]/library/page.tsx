import { notFound } from "next/navigation";
import AppLibraryClient from "@/components/app-vnext/AppLibraryClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { readAppLibrarySection } from "@/lib/discovery-continuity";

export default async function AppLibraryPage({ params, searchParams }: { params: Promise<{ surface: string }>; searchParams?: Promise<{ section?: string | string[] }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const query = searchParams ? await searchParams : {};
  const value = Array.isArray(query.section) ? query.section[0] : query.section;
  const initialSection = readAppLibrarySection(new URLSearchParams(value ? { section: value } : {}));
  return <AppLibraryClient key={`${raw}:${initialSection}`} surface={raw as AppSurface} initialSection={initialSection} />;
}
