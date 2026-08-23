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
      item.reason === "following" ? "From your follows" : undefined,
      new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        -Math.max(0, Math.floor((Date.now() - new Date(item.occurredAt).getTime()) / 86_400_000)),
        "day",
      ),
    ].filter(Boolean) as string[],
    primaryAction: {
      id: "open",
      label: item.subject.kind === "story" ? "Read" : item.subject.kind === "show" ? "Show" : "Open",
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
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="bvs-pulse-title">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Inside BVS now</p>
          <h2 id="bvs-pulse-title" className="mt-2 text-3xl font-semibold sm:text-4xl">A compact pulse of what changed.</h2>
          <p className="mt-3 text-text-secondary">Published music, creator work, verified credits and show activity—not private listener behaviour.</p>
        </div>
        <Link href="/search" className="text-sm font-semibold text-brand hover:underline">Keep exploring →</Link>
      </div>

      {state === "loading" ? (
        <div className="grid gap-3 md:grid-cols-2" aria-label="Loading BVS Pulse">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/5" />)}
        </div>
      ) : null}

      {state === "error" ? (
        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6">
          <p>We couldn&apos;t load BVS Pulse right now.</p>
          <button type="button" onClick={() => { setState("loading"); setRetry((value) => value + 1); }} className="mt-4 min-h-11 rounded-full border border-white/15 px-4 text-sm text-brand">Try again</button>
        </div>
      ) : null}

      {state === "ready" && !items.length ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-7 text-text-secondary">
          Nothing new from your follows yet. Explore BVS and follow the people and shows you want to keep up with.
        </div>
      ) : null}

      {state === "ready" && items.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {items.slice(0, 6).map((item) => (
            <div key={item.id} onClick={() => trackEvent("pulse_item_open", { activity_id: item.id, activity_kind: item.kind })}>
              <BvsObjectCard object={activityObject(item)} variant="compact-row" />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
