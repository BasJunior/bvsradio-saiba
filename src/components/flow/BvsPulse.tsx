"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
import type { BvsActivityItem } from "@/lib/activity";
import type { BvsObject } from "@/lib/bvs-object";
import { trackEvent } from "@/lib/analytics";

function activityObject(item: BvsActivityItem): BvsObject {
  return {
    ...item.subject,
    contextLabel: item.label,
    metadata: [
      item.reason === "following" ? "From something you follow" : undefined,
      new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        -Math.max(0, Math.floor((Date.now() - new Date(item.occurredAt).getTime()) / 86_400_000)),
        "day",
      ),
    ].filter(Boolean) as string[],
    primaryAction: {
      id: "open",
      label: item.subject.kind === "story" ? "Read" : item.subject.kind === "show" ? "View show" : "Open",
      intent: "navigate",
      href: item.subject.route,
    },
    overflowActions: [{ id: "open", label: "Open on BVS", intent: "navigate", href: item.subject.route }],
    rightsState: "published",
  };
}

export default function BvsPulse() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = useState<BvsActivityItem[]>([]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pulse?scope=following", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Pulse unavailable");
        return response.json() as Promise<{ items?: BvsActivityItem[] }>;
      })
      .then((payload) => {
        const next = payload.items || [];
        setItems(next);
        setState("ready");
        if (next.length) trackEvent("pulse_impression", { item_count: next.length });
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, [retry]);

  return (
    <section className="border-y border-white/10 bg-white/[.015]" aria-labelledby="bvs-pulse-title">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d8b36a]">BVS Pulse</p>
            <h2 id="bvs-pulse-title" className="mt-2 text-2xl font-semibold sm:text-3xl">What&apos;s alive inside BVS</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">High-signal public activity from music, credits, creators and shows. Following changes what gets surfaced; private listener activity stays private.</p>
          </div>
          <Link href="/search" className="text-sm text-brand hover:underline">Explore more →</Link>
        </div>

        {state === "loading" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading BVS Pulse">
            {[0, 1, 2].map((item) => <div key={item} className="aspect-[4/3] animate-pulse rounded-2xl bg-white/5" />)}
          </div>
        ) : null}

        {state === "error" ? (
          <div className="rounded-2xl border border-white/10 p-5">
            <p className="text-sm">We couldn&apos;t load BVS Pulse right now.</p>
            <button type="button" onClick={() => { setState("loading"); setRetry((value) => value + 1); }} className="mt-4 min-h-11 rounded-full border border-white/15 px-4 text-sm text-brand">Try again</button>
          </div>
        ) : null}

        {state === "ready" && !items.length ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-text-secondary">Nothing new from your follows yet. Explore BVS and follow artists, producers or shows to shape this feed.</div>
        ) : null}

        {state === "ready" && items.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, 6).map((item) => (
              <div key={item.id} onClick={() => trackEvent("pulse_item_open", { activity_id: item.id, activity_kind: item.kind })}>
                <BvsObjectCard object={activityObject(item)} variant="grid-card" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
