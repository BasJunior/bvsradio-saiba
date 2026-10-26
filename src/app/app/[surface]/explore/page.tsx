import { notFound } from "next/navigation";
import AppExploreClient from "@/components/app-vnext/AppExploreClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { readAppExploreState } from "@/lib/discovery-continuity";

export default async function AppExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const queryParams = searchParams ? await searchParams : {};
  const serialized = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) serialized.set(key, first);
  }
  const initial = readAppExploreState(serialized);
  return <AppExploreClient key={`${raw}:${initial.query}:${initial.kind}:${initial.genre}:${initial.mode}`} surface={raw as AppSurface} initialState={initial} />;
}
