"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { BvsActivityItem } from "@/lib/activity";
import { trackEvent } from "@/lib/analytics";

type PulsePayload = {
  items?: BvsActivityItem[];
  scope?: "global" | "following" | "creator";
};

function ActivityRow({ item }: { item: BvsActivityItem }) {
  return (
    <Link
      href={item.subject.route}
      onClick={() => trackEvent("pulse_item_open", {
        activity_id: item.id,
        activity_kind: item.kind,
        source: "your_bvs",
      })}
      className="group flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-4 hover:border-brand/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[.16em] text-brand">{item.label}</span>
        <span className="mt-1 block truncate font-medium group-hover:text-brand">{item.subject.title}</span>
        {item.subject.subtitle ? <span className="mt-1 block truncate text-xs text-text-secondary">{item.subject.subtitle}</span> : null}
      </span>
      <span className="shrink-0 text-sm text-brand" aria-hidden="true">→</span>
    </Link>
  );
}

export default function YourBvsActivity() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [payload, setPayload] = useState<PulsePayload>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pulse?scope=following", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Your BVS activity unavailable");
        return response.json() as Promise<PulsePayload>;
      })
      .then((next) => {
        setPayload(next);
        setState("ready");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, []);

  const { upcoming, recent } = useMemo(() => {
    const items = payload.items || [];
    return {
      upcoming: items.filter((item) => item.kind === "show_scheduled" || item.kind === "show_live").slice(0, 3),
      recent: items.filter((item) => item.kind !== "show_scheduled" && item.kind !== "show_live").slice(0, 4),
    };
  }, [payload.items]);

  if (state === "loading") {
    return (
      <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Loading Your BVS updates">
        {[0, 1].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-white/[.04]" />)}
      </div>
    );
  }

  if (state !== "ready" || (!recent.length && !upcoming.length)) return null;

  return (
    <div className="mt-6 space-y-6">
      {recent.length ? (
        <section aria-labelledby="your-bvs-recent-title">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">
            {payload.scope === "following" ? "New from people you follow" : "Fresh on BVS"}
          </p>
          <h2 id="your-bvs-recent-title" className="mt-1 text-2xl font-semibold">
            {payload.scope === "following" ? "What changed while you were away" : "Something new to explore"}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {recent.map((item) => <ActivityRow key={item.id} item={item} />)}
          </div>
        </section>
      ) : null}

      {upcoming.length ? (
        <section aria-labelledby="your-bvs-upcoming-title">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Upcoming</p>
          <h2 id="your-bvs-upcoming-title" className="mt-1 text-2xl font-semibold">Shows worth returning for</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {upcoming.map((item) => <ActivityRow key={item.id} item={item} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
