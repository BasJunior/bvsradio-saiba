"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublishedProducerSummary } from "@/lib/artist-content";
import DiscoveryShelf from "@/components/discovery/DiscoveryShelf";
import ArtistPortraitTile from "@/components/discovery/ArtistPortraitTile";

export default function PublishedProducersShelf({
  onBrowse,
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
      <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">
        Loading published producers…
      </p>
    );
  if (failed)
    return (
      <p className="rounded-xl border border-dashed border-red-400/20 p-5 text-sm text-red-200">
        Producer profiles could not be loaded. Refresh to try again.
      </p>
    );
  if (!producers.length)
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">
        No producers have a published BeatStore listing yet.
      </p>
    );

  return (
    <DiscoveryShelf
      eyebrow="Verified producers"
      title="Live crates"
      description="Circular portraits, live crates, and a licence path that stays separate from listening."
      action={
        <Link
          href="/music/producers"
          className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand"
        >
          View all producers →
        </Link>
      }
    >
      {producers.map((producer) => (
        <div key={producer.id} className="shrink-0 snap-start">
          <ArtistPortraitTile
            href={`/artist/${producer.username}`}
            name={producer.name}
            image={producer.image}
            detail={`${producer.beatCount} published ${producer.beatCount === 1 ? "beat" : "beats"}`}
            tags={producer.genres}
          />
          <button
            type="button"
            onClick={() => onBrowse(producer)}
            className="mt-2 w-full text-sm font-semibold text-brand hover:underline"
          >
            License crate
          </button>
        </div>
      ))}
    </DiscoveryShelf>
  );
}
