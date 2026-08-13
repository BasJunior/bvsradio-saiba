import Link from "next/link";
import { notFound } from "next/navigation";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
import { getAppEditionBeats } from "@/lib/app-edition-data";
import { beatToObject } from "@/lib/bvs-object-builders";
import type { MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";

export default async function AppBeatsPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface: rawSurface } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  const surface = rawSurface as MobileSurface;
  const beats = await getAppEditionBeats(24);
  const objects = beats.map((beat) => beatToObject(beat, { surface }));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 pt-5 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">BeatStore</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Beats from BVS producers</h1>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">
        Preview stays in the BVS player. Licence options open the full listing.
      </p>
      {objects.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {objects.map((object) => (
            <BvsObjectCard key={object.id} object={object} variant="grid-card" />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center">
          <h2 className="text-xl font-semibold">Published beats will appear here</h2>
          <p className="mt-2 text-sm text-text-secondary">BeatStore listings are added after BVS Editorial approval.</p>
        </div>
      )}
      <p className="mt-8 text-center text-sm text-text-secondary">
        Need the full commercial listing?{" "}
        <Link href="/catalogue?type=beat#beatstore" className="text-brand hover:underline">Open BeatStore</Link>
      </p>
    </div>
  );
}
