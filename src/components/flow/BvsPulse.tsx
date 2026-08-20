"use client";

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
      item.reason === "following" ? "From a creator you follow" : undefined,
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
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="bvs-pulse-title">
      <div className="mb-7 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Pulse</p>
        <h2 id="bvs-pulse-title" className="mt-2 text-3xl font-semibold sm:text-4xl">What&apos;s alive inside BVS</h2>
        <p className="mt-3 text-text-secondary">Published music, verified credits, creator work and shows—not private listener activity.</p>
      </div>

      {state === "loading" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading BVS Pulse">
          {[0, 1, 2].map((item) => <div key={item} className="aspect-[4/3] animate-pulse rounded-3xl bg-white/5" />)}
        </div>
      ) : null}

      {state === "error" ? (
        <div className="rounded-3xl border border-white/10 p-6">
          <p>We couldn&apos;t load BVS Pulse right now.</p>
          <button type="button" onClick={() => { setState("loading"); setRetry((value) => value + 1); }} className="mt-4 min-h-11 rounded-full border border-white/15 px-4 text-sm text-brand">Try again</button>
        </div>
      ) : null}

      {state === "ready" && !items.length ? (
        <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-text-secondary">
          Nothing new from your follows yet. Explore BVS.
        </div>
      ) : null}

      {state === "ready" && items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 9).map((item) => (
            <div key={item.id} onClick={() => trackEvent("pulse_item_open", { activity_id: item.id, activity_kind: item.kind })}>
              <BvsObjectCard object={activityObject(item)} variant="grid-card" />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
