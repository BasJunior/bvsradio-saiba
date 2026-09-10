import { notFound } from "next/navigation";
import BvsFeedList from "@/components/feed/BvsFeedList";
import { getBvsFeed } from "@/lib/bvs-feed";
import type { AppSurface } from "@/lib/app-surface";

export const dynamic = "force-dynamic";

export default async function AppFeedPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const surface = raw as AppSurface;
  const items = await getBvsFeed({ surface, limit: 90 });

  return (
    <main className="bvs-page-main mx-auto min-h-[100dvh] max-w-4xl px-4 pb-10 sm:px-6">
      <header className="pb-5 pt-6 sm:pb-7 sm:pt-8">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-brand">
          <span className="h-2 w-2 rounded-full bg-brand shadow-[0_0_18px_rgba(212,175,55,.75)]" aria-hidden="true" />
          BVS Pulse
        </div>
        <h1 className="mt-3 text-[2.4rem] font-semibold leading-none tracking-tight sm:text-5xl">Feed</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/48 sm:text-base">
          The newest movement across BVS — music, creators, beats, live moments and Marketplace drops.
        </p>
      </header>

      <BvsFeedList items={items} />
      <div className="bvs-app-bottom-spacer" aria-hidden="true" />
    </main>
  );
}
