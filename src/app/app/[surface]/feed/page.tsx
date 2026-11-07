import { notFound } from "next/navigation";
import BvsFeedList from "@/components/feed/BvsFeedList";
import { getBvsFeed } from "@/lib/bvs-feed";
import type { AppSurface } from "@/lib/app-surface";
import { participationEnabled } from "@/lib/participation-server";

export const dynamic = "force-dynamic";

export default async function AppFeedPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const surface = raw as AppSurface;
  const items = await getBvsFeed({ surface, limit: 90 });
  const participation = participationEnabled();

  return (
    <main className="bvs-app-page bvs-app-feed bvs-page-main mx-auto min-h-[100dvh] max-w-4xl px-4 pb-10 pt-5 sm:px-6" data-app-accent="feed">
      <header>
        <p className="bvs-app-eyebrow">BVS Pulse</p>
        <h1 className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">Feed</h1>
        <p className="mt-2 text-sm text-white/45">
          {participation
            ? "See what’s moving across BVS, then like, repost and join in."
            : "The newest music, creators, beats and live moments on BVS."}
        </p>
      </header>

      <BvsFeedList items={items} surface={surface} participationEnabled={participation} />
      <div className="bvs-app-bottom-spacer" aria-hidden="true" />
    </main>
  );
}
