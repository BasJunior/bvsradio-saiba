"use client";

import { useEffect, useState } from "react";
import type { PublishedProducerSummary } from "@/lib/artist-content";
import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";

export default function PublishedProducersShelf({
  onBrowse: _onBrowse,
}: {
  onBrowse: (producer: PublishedProducerSummary) => void;
}) {
  const [producers, setProducers] = useState<PublishedProducerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/producers", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload) => setProducers(payload.producers || []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <p className="border border-dashed border-white/10 p-5 text-sm text-text-secondary">
        Loading published producers…
      </p>
    );

  if (failed)
    return (
      <p className="border border-dashed border-red-400/20 p-5 text-sm text-red-200">
        Producer profiles could not be loaded. Refresh to try again.
      </p>
    );

  return (
    <CreatorPortraitRail
      title="Producers"
      kicker="The people behind the beats"
      tone="ink"
      accent="purple"
      allHref="/music/producers"
      emptyMessage="Browse all published beats below."
      items={producers.map((producer) => ({
        id: producer.id,
        name: producer.name,
        image: producer.image,
        href: `/catalogue?type=beat&producer=${encodeURIComponent(producer.username)}#browse`,
        detail: `${producer.beatCount} ${producer.beatCount === 1 ? "beat" : "beats"} · BeatStore`,
      }))}
    />
  );
}
