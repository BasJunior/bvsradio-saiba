"use client";

import { useMemo, useState } from "react";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
import LibraryAction from "@/components/LibraryAction";
import type { BvsFeedCategory, BvsFeedFilter, BvsFeedItem } from "@/lib/bvs-feed";
import { shareBvs } from "@/lib/app-native";
import { canonicalBvsShareUrl } from "@/lib/share-url";

const filters: Array<{ id: BvsFeedFilter; label: string }> = [
  { id: "all", label: "Latest" },
  { id: "music", label: "Music" },
  { id: "creator", label: "Creators" },
  { id: "beat", label: "Beats" },
  { id: "live", label: "Live" },
  { id: "marketplace", label: "Marketplace" },
];

const categoryLabel: Record<BvsFeedCategory, string> = {
  music: "Music",
  creator: "Creator",
  beat: "BeatStore",
  live: "Live",
  marketplace: "Marketplace",
};

function relativeTime(iso: string) {
  const age = Math.max(0, Date.now() - Date.parse(iso));
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

export default function BvsFeedList({ items }: { items: BvsFeedItem[] }) {
  const [filter, setFilter] = useState<BvsFeedFilter>("all");
  const visible = useMemo(
    () => filter === "all" ? items : items.filter((item) => item.category === filter),
    [filter, items],
  );

  async function share(item: BvsFeedItem) {
    await shareBvs({
      title: item.object.title,
      text: `${item.verb} · ${item.object.subtitle || "BVS"}`,
      url: canonicalBvsShareUrl(item.object.route),
    });
  }

  return (
    <div>
      <div className="sticky top-[var(--bvs-app-header-height,4rem)] z-20 -mx-4 overflow-x-auto border-y border-white/[.06] bg-[#08080a]/92 px-4 py-3 backdrop-blur-2xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0" aria-label="Feed filters">
        <div className="flex min-w-max gap-2 sm:flex-wrap">
          {filters.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={active}
                className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${active ? "border-brand bg-brand text-black" : "border-white/10 bg-white/[.035] text-white/58 hover:border-white/20 hover:text-white"}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 space-y-4 sm:mt-7">
        {visible.map((item) => (
          <article key={item.id} className="rounded-[1.65rem] border border-white/[.075] bg-white/[.018] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">{categoryLabel[item.category]}</span>
                  <span className="text-white/20" aria-hidden="true">•</span>
                  <span className="text-xs font-medium text-white/72">{item.verb}</span>
                </div>
              </div>
              <time dateTime={item.occurredAt} className="shrink-0 text-xs tabular-nums text-white/35" title={item.occurredAt}>
                {relativeTime(item.occurredAt)}
              </time>
            </div>

            <BvsObjectCard object={item.object} variant="compact-row" />

            <div className="mt-3 flex min-h-11 flex-wrap items-center gap-2 border-t border-white/[.055] px-1 pt-3">
              {item.social ? (
                <LibraryAction item={item.social.item} section={item.social.section} compact />
              ) : null}
              <button
                type="button"
                onClick={() => void share(item)}
                className="min-h-9 rounded-full border border-white/10 px-3 text-xs font-medium text-white/55 transition hover:border-brand/35 hover:text-brand"
                aria-label={`Share ${item.object.title}`}
              >
                Share
              </button>
              <span className="ml-auto hidden text-[10px] uppercase tracking-[.14em] text-white/25 sm:inline">BVS pulse</span>
            </div>
          </article>
        ))}

        {!visible.length ? (
          <div className="rounded-[1.65rem] border border-white/[.07] bg-white/[.02] px-5 py-12 text-center">
            <p className="text-sm font-medium text-white/70">Nothing new in this lane yet.</p>
            <p className="mt-2 text-xs text-white/38">When something publishes or goes live on BVS, it will appear here.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
