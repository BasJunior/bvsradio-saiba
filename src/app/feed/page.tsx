import type { Metadata } from "next";
import { AppSessionProvider } from "@/components/app-vnext/AppSessionProvider";
import BvsFeedList from "@/components/feed/BvsFeedList";
import { participationEnabled } from "@/lib/participation-server";
import { getBvsFeed } from "@/lib/bvs-feed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BVS Feed | What’s moving now",
  description: "New music, creators, BeatStore drops, shows and Marketplace activity across BVS.",
};

export default async function BvsFeedPage() {
  const items = await getBvsFeed({ limit: 150 });

  return (
    <main className="bvs-app-page bvs-app-feed mx-auto min-h-screen max-w-4xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10" data-app-accent="feed">
      <header>
        <p className="bvs-app-eyebrow">BVS Pulse</p>
        <h1 className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">Feed</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50 sm:text-base">New music, creators, beats and live moments across BVS. Your music keeps playing while you explore.</p>
      </header>

      {/* Shared Feed list requires the app session boundary even while participation is gated. */}
      <AppSessionProvider>
        <BvsFeedList items={items} surface={null} participationEnabled={participationEnabled()} />
      </AppSessionProvider>
    </main>
  );
}
