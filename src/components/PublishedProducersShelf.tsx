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
    <div>
      <div className="mb-3 flex justify-end">
        <Link href="/music/producers" className="text-sm font-medium text-brand hover:underline">
          All producers →
        </Link>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {producers.map((producer) => (
          <article
            key={producer.id}
            className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-brand/40 hover:bg-white/[0.035]"
          >
            <Link
              href={`/artist/${producer.username}`}
              className="relative block h-14 w-14 flex-none overflow-hidden rounded-full border border-white/10 bg-black/40"
            >
              <Image
                src={producer.image}
                alt={producer.name}
                fill
                unoptimized={/^https?:\/\//i.test(producer.image)}
                sizes="56px"
                className="object-cover object-center"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/artist/${producer.username}`} className="block truncate text-sm font-semibold group-hover:text-brand">
                {producer.name}
              </Link>
              <p className="truncate text-xs text-text-secondary">
                {producer.beatCount} published {producer.beatCount === 1 ? "beat" : "beats"}
                {producer.genres.length ? ` · ${producer.genres.slice(0, 2).join(" · ")}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <button type="button" onClick={() => onBrowse(producer)} className="font-semibold text-brand hover:underline">
                  Open crate →
                </button>
                <Link href={`/artist/${producer.username}`} className="text-text-secondary hover:text-white">
                  Profile
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
