"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublishedArtistSummary, PublishedProducerSummary } from "@/lib/artist-content";
import CreatorPortraitRail from "./CreatorPortraitRail";

export default function HomeCreatorBands() {
  const [artists, setArtists] = useState<PublishedArtistSummary[]>([]);
  const [producers, setProducers] = useState<PublishedProducerSummary[]>([]);
  const [failed, setFailed] = useState(false);
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
    <CreatorPortraitRail title="Artists" tone="charcoal" allHref="/music/artists" items={artists.map(artist => ({ id: artist.id, name: artist.name, image: artist.image, href: `/artist/${encodeURIComponent(artist.username)}`, detail: `${artist.trackCount} published ${artist.trackCount === 1 ? "track" : "tracks"}` }))} />
    <CreatorPortraitRail title="Producers" tone="ink" accent="purple" allHref="/music/producers" items={producers.map(producer => ({ id: producer.id, name: producer.name, image: producer.image, href: `/artist/${encodeURIComponent(producer.username)}`, detail: `${producer.beatCount} ${producer.beatCount === 1 ? "beat" : "beats"} · BeatStore` }))} />
    {failed ? <p className="px-4 py-6 text-center text-sm text-text-secondary">Creator portraits are temporarily unavailable. <Link href="/music/artists" className="underline">Explore the artist directory</Link>.</p> : null}
  </div>;
}
