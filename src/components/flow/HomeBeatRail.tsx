"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
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

export default function HomeBeatRail() {
  const [beats, setBeats] = useState<PublicBeat[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/beats", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { beats?: PublicBeat[] }) => { if (active) setBeats((payload.beats || []).slice(0, 8)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!beats.length) return null;

  const objects: BvsObject[] = beats.map((beat) => ({
    id: beat.id,
    kind: "beat",
    route: `/catalogue?type=beat&beat=${encodeURIComponent(beat.slug || beat.id)}#beatstore`,
    title: beat.title,
    subtitle: beat.producer || "BVS producer",
    artwork: beat.artworkUrl,
    contextLabel: "Fresh from BeatStore",
    metadata: [beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : undefined, beat.musical_key].filter(Boolean) as string[],
    availabilityLabel: beat.startingPrice ? `Licences from $${beat.startingPrice}` : "Licence options available",
    media: beat.previewUrl ? { src: beat.previewUrl, artist: beat.producer, artwork: beat.artworkUrl, genre: beat.genre, project: "BVS BeatStore" } : undefined,
    primaryAction: beat.previewUrl ? { id: "preview", label: "Preview", intent: "play" } : { id: "view", label: "View beat", intent: "navigate", href: `/catalogue?type=beat&beat=${encodeURIComponent(beat.slug || beat.id)}#beatstore` },
    overflowActions: [
      { id: "producer", label: "Find producer", intent: "navigate", href: `/search?q=${encodeURIComponent(beat.producer || "")}` },
      { id: "licence", label: "View licence", intent: "navigate", href: `/catalogue?type=beat&beat=${encodeURIComponent(beat.slug || beat.id)}#beatstore` },
    ],
    rightsState: "published",
  }));

  return (
    <section className="border-y border-white/10 bg-bg-secondary/45 py-12 sm:py-16" aria-labelledby="fresh-beats-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-xs uppercase tracking-[.2em] text-brand">Connected discovery</p><h2 id="fresh-beats-title" className="mt-2 text-3xl sm:text-4xl">Fresh from BeatStore</h2><p className="mt-2 text-sm text-text-secondary">Preview a producer’s work without leaving the BVS listening flow.</p></div>
          <Link href="/catalogue?type=beat#beatstore" className="hidden text-sm text-brand hover:underline sm:block">View all beats →</Link>
        </div>
        <div className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4" data-flow-scroll-key="home-beatstore">
          {objects.map((object) => <div key={object.id} className="snap-start"><BvsObjectCard object={object} variant="rail-card" /></div>)}
        </div>
      </div>
    </section>
  );
}
