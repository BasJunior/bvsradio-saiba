"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BvsActivityItem } from "@/lib/activity";
import { trackEvent } from "@/lib/analytics";

function relativeDate(value: string) {
  const occurred = new Date(value).getTime();
  if (!Number.isFinite(occurred)) return "Recently";
  const days = Math.max(0, Math.floor((Date.now() - occurred) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default function CreatorActivity({ creatorId }: { creatorId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = useState<BvsActivityItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/pulse?scope=global&creator=${encodeURIComponent(creatorId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Creator activity unavailable");
        return response.json() as Promise<{ items?: BvsActivityItem[] }>;
      })
      .then((payload) => {
        setItems(payload.items || []);
        setState("ready");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, [creatorId]);

  if (state === "loading") {
    return (
      <section className="mt-10" aria-label="Loading creator activity">
        <div className="h-5 w-44 animate-pulse rounded bg-white/5" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-white/[.04]" />)}
        </div>
      </section>
    );
  }

  if (state !== "ready" || !items.length) return null;

  return (
    <section id="latest" className="mt-10 scroll-mt-24" aria-labelledby="creator-latest-title">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Latest from this creator</p>
      <h2 id="creator-latest-title" className="mt-1 text-2xl font-semibold">What&apos;s happening on BVS</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.slice(0, 6).map((item) => (
          <Link
            key={item.id}
            href={item.subject.route}
            onClick={() => trackEvent("creator_activity_open", {
              activity_id: item.id,
              activity_kind: item.kind,
              creator_id: creatorId,
            })}
            className="group flex min-h-24 items-center gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-3 hover:border-brand/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {item.subject.artwork ? (
                <Image
                  src={item.subject.artwork}
                  alt=""
                  fill
                  unoptimized={/^https?:\/\//.test(item.subject.artwork)}
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-[10px] font-bold tracking-[.16em] text-brand">BVS</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[.16em] text-brand">{item.label}</span>
              <span className="mt-1 block truncate font-medium group-hover:text-brand">{item.subject.title}</span>
              <span className="mt-1 block truncate text-xs text-text-secondary">
                {item.subject.subtitle ? `${item.subject.subtitle} · ` : ""}{relativeDate(item.occurredAt)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
