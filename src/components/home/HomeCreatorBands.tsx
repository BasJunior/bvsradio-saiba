"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { PublishedArtistSummary, PublishedProducerSummary } from "@/lib/artist-content";
import CreatorPortraitRail from "./CreatorPortraitRail";
import type { MobileSurface } from "@/lib/station-library";

export default function HomeCreatorBands({ children, surface }: { children?: ReactNode; surface?: MobileSurface }) {
  const [artists, setArtists] = useState<PublishedArtistSummary[]>([]);
  const [producers, setProducers] = useState<PublishedProducerSummary[]>([]);
  const [failed, setFailed] = useState(false);
  const artistBase = surface ? `/app/${surface}/explore?kind=artists` : "/music/artists";
  const producerBase = surface ? `/app/${surface}/explore?kind=producers` : "/music/producers";
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const deadline = window.setTimeout(() => controller.abort(), 10000);
    async function load() {
      const [artistResult, producerResult] = await Promise.allSettled([
        fetch("/api/artists", { signal: controller.signal }).then(response => response.ok ? response.json() : Promise.reject()),
        fetch("/api/producers", { signal: controller.signal }).then(response => response.ok ? response.json() : Promise.reject()),
      ]);
      window.clearTimeout(deadline);
      if (!active) return;
      if (artistResult.status === "fulfilled") setArtists(artistResult.value.artists || []);
      if (producerResult.status === "fulfilled") setProducers((producerResult.value.producers || []).slice(0, 18));
      setFailed(artistResult.status === "rejected" && producerResult.status === "rejected");
    }
    void load();
    return () => { active = false; window.clearTimeout(deadline); controller.abort(); };
  }, []);
  return <div className="bvs-creator-bands">
    <CreatorPortraitRail autoScroll retainBrowseLink title="Artists" tone="charcoal" allHref={artistBase} items={artists.map(artist => ({ id: artist.id, name: artist.name, image: artist.image, href: surface ? `/app/${surface}/creator/${encodeURIComponent(artist.username)}` : `/artist/${encodeURIComponent(artist.username)}`, detail: `${artist.trackCount} published ${artist.trackCount === 1 ? "track" : "tracks"}` }))} />
    {children}
    <CreatorPortraitRail autoScroll retainBrowseLink title="Producers" tone="ink" accent="purple" allHref={producerBase} items={producers.map(producer => ({ id: producer.id, name: producer.name, image: producer.image, href: surface ? `/app/${surface}/creator/${encodeURIComponent(producer.username)}?as=producer` : `/artist/${encodeURIComponent(producer.username)}`, detail: `${producer.beatCount} ${producer.beatCount === 1 ? "beat" : "beats"} · BeatStore` }))} />
    {failed ? <p className="px-4 py-6 text-center text-sm text-text-secondary">Creator portraits are temporarily unavailable. <Link href={artistBase} className="underline">Explore the artist directory</Link>.</p> : null}
  </div>;
}
