"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
import LibraryAction from "@/components/LibraryAction";
import type { BvsObject } from "@/lib/bvs-object";

type PublicBeat = {
  id: string;
  slug?: string;
  title: string;
  producer?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  musical_key?: string;
  artworkUrl?: string;
  previewUrl?: string;
  startingPrice?: number;
};

type HomeBeatRailProps = {
  limit?: number;
  marketplaceShowcase?: boolean;
};

export default function HomeBeatRail({ limit = 8, marketplaceShowcase = false }: HomeBeatRailProps) {
  const [beats, setBeats] = useState<PublicBeat[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`/api/beats?limit=${Math.min(120, Math.max(1, limit))}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { beats?: PublicBeat[] }) => { if (active) setBeats(payload.beats || []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [limit]);

  if (!beats.length) return null;

  const objects: BvsObject[] = beats.map((beat) => ({
    id: beat.id,
    kind: "beat",
    route: `/beat/${beat.id}`,
    title: beat.title,
    subtitle: beat.producer || "BVS producer",
    artwork: beat.artworkUrl,
    contextLabel: "BeatStore",
    metadata: [beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : undefined, beat.musical_key].filter(Boolean) as string[],
    availabilityLabel: beat.startingPrice ? `Licences from $${beat.startingPrice}` : "Licence options available",
    media: beat.previewUrl ? { src: beat.previewUrl, artist: beat.producer, artwork: beat.artworkUrl, genre: beat.genre, project: "BVS BeatStore" } : undefined,
    primaryAction: beat.previewUrl ? { id: "preview", label: "Preview", intent: "play" } : { id: "view", label: "View beat", intent: "navigate", href: `/beat/${beat.id}` },
    overflowActions: [
      { id: "details", label: "View beat", intent: "navigate", href: `/beat/${beat.id}` },
      { id: "producer", label: "Find producer", intent: "navigate", href: `/search?q=${encodeURIComponent(beat.producer || "")}` },
    ],
    rightsState: "published",
  }));

  if (marketplaceShowcase) {
    return (
      <section data-home-accent="beats" className="border-y border-white/10 bg-black/45 py-5 sm:py-6" aria-label="BVS BeatStore">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="bvs-home-accent-label text-[10px] font-semibold uppercase tracking-[.2em]">BeatStore</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Find your next beat</h2>
              <p className="mt-1 text-sm text-white/60">Preview every published beat, compare producers and open licence options.</p>
            </div>
            <Link href="/catalogue?type=beat#beatstore" className="bvs-home-accent-button border px-4 py-2 text-sm font-semibold">Browse full BeatStore →</Link>
          </div>

          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
            {objects.map((object, index) => {
              const beat = beats[index];
              const href = `/beat/${beat.id}`;
              return (
                <div key={object.id} className="w-[17rem] shrink-0 snap-start sm:w-[18rem]">
                  <BvsObjectCard object={object} variant="rail-card" />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-brand">
                      {beat.startingPrice ? `From $${beat.startingPrice}` : "Licences available"}
                    </span>
                    <LibraryAction item={{ id: `beat-${beat.id}`, kind: 'beat', title: beat.title, subtitle: beat.producer || 'BVS producer', href, image: beat.artworkUrl, tags: [beat.genre || '', beat.mood || ''].filter(Boolean) }} section="favourites" compact />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <CreatorPortraitRail data-home-accent="beats" title="BeatStore" kicker="Find the sound for your next record" tone="ink" accent="purple" allHref="/catalogue?type=beat#beatstore" items={beats.map(beat => ({ id: beat.id, name: beat.title, image: beat.artworkUrl || "", href: `/beat/${beat.id}`, detail: beat.producer || "BVS producer" }))}>
      {objects.map((object, index) => {
        const beat = beats[index];
        const href = `/beat/${beat.id}`;
        return <div key={object.id} className="bvs-home-beat-portrait bvs-creator-portrait">
          <BvsObjectCard object={object} variant="rail-card" />
          <div className="mt-2 flex justify-end">
            <LibraryAction item={{ id: `beat-${beat.id}`, kind: 'beat', title: beat.title, subtitle: beat.producer || 'BVS producer', href, image: beat.artworkUrl, tags: [beat.genre || '', beat.mood || ''].filter(Boolean) }} section="favourites" compact />
          </div>
        </div>;
      })}
    </CreatorPortraitRail>
  );
}
