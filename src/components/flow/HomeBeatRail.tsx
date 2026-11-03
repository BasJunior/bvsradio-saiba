"use client";

import { useEffect, useState } from "react";
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

export default function HomeBeatRail() {
  const [beats, setBeats] = useState<PublicBeat[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/beats?limit=8")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { beats?: PublicBeat[] }) => { if (active) setBeats(payload.beats || []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!beats.length) return null;

  const objects: BvsObject[] = beats.map((beat) => ({
    id: beat.id,
    kind: "beat",
    route: `/beat/${beat.id}`,
    title: beat.title,
    subtitle: beat.producer || "BVS producer",
    artwork: beat.artworkUrl,
    contextLabel: "Fresh from BeatStore",
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
