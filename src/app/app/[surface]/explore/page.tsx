import { Suspense } from "react";
import { notFound } from "next/navigation";
import AppExploreView from "@/components/app/AppExploreView";
import { getAppEditionBeats } from "@/lib/app-edition-data";
import { getStationTracks, type MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";

export default async function AppExplorePage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface: rawSurface } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  const surface = rawSurface as MobileSurface;
  const [tracks, beats] = await Promise.all([getStationTracks(surface), getAppEditionBeats(16)]);

  return (
    <Suspense fallback={<div className="px-4 py-10 text-sm text-text-secondary">Loading explore…</div>}>
      <AppExploreView surface={surface} tracks={tracks} beats={beats} />
    </Suspense>
  );
}
