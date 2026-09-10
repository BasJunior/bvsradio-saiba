import type { Metadata } from "next";
import BvsFeedList from "@/components/feed/BvsFeedList";
import { getBvsFeed } from "@/lib/bvs-feed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BVS Feed | What’s moving now",
  description: "New music, creators, BeatStore drops, shows and Marketplace activity across BVS.",
};

export default async function BvsFeedPage() {
  const items = await getBvsFeed({ limit: 90 });

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 pb-32 pt-24 sm:px-6 sm:pt-28">
      <header className="mb-7 sm:mb-9">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.24em] text-brand">
          <span className="h-2 w-2 rounded-full bg-brand shadow-[0_0_18px_rgba(212,175,55,.75)]" aria-hidden="true" />
          BVS Pulse
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">What’s moving now.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
          New releases, rotation adds, creators, beats, shows and Marketplace drops — one living view of what is happening across BVS.
        </p>
      </header>

      <BvsFeedList items={items} />
    </main>
  );
}
