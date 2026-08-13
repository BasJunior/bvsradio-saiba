"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PublishedProducerSummary } from "@/lib/artist-content";

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
    <>
      <div className="mb-5 flex justify-end">
        <Link
          href="/music/producers"
          className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand"
        >
          View all producers →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {producers.map((producer) => (
          <article
            key={producer.id}
            className="group min-w-0"
          >
            <Link href={`/artist/${producer.username}`} className="relative block aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <Image
                src={producer.image}
                alt={producer.name}
                fill
                unoptimized={/^https?:\/\//i.test(producer.image)}
                sizes="(max-width:768px) 50vw, 160px"
                className="object-cover object-center transition duration-300 group-hover:scale-[1.04]"
              />
            </Link>
            <Link href={`/artist/${producer.username}`} className="mt-3 block truncate font-semibold group-hover:text-brand">{producer.name}</Link>
              <p className="truncate text-xs text-text-secondary">
                {producer.beatCount} published{" "}
                {producer.beatCount === 1 ? "beat" : "beats"}
                {producer.genres.length
                  ? ` · ${producer.genres.join(" · ")}`
                  : ""}
              </p>
              <div className="mt-2 flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => onBrowse(producer)}
                  className="text-brand"
                >
                  View catalogue →
                </button>
              </div>
          </article>
        ))}
      </div>
    </>
  );
}
