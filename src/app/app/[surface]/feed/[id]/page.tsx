import Link from "next/link";
import { notFound } from "next/navigation";
import ParticipationThreadPanel from "@/components/feed/ParticipationThreadPanel";
import type { AppSurface } from "@/lib/app-surface";
import { participationEnabled } from "@/lib/participation-server";

export const dynamic = "force-dynamic";

export default async function AppParticipationThreadPage({
  params,
}: {
  params: Promise<{ surface: string; id: string }>;
}) {
  const { surface: rawSurface, id } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  if (!participationEnabled()) notFound();
  const surface = rawSurface as AppSurface;
  const threadId = String(id || "").trim();
  if (!threadId) notFound();

  return (
    <main className="bvs-app-page bvs-app-feed bvs-page-main mx-auto min-h-[100dvh] max-w-3xl px-4 pb-12 pt-4 sm:px-6" data-app-accent="feed">
      <header className="pb-4">
        <Link href={`/app/${surface}/feed`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-white/60 transition hover:text-white">
          <span aria-hidden="true">‹</span> Feed
        </Link>
        <h1 className="mt-3 text-[2rem] font-bold leading-none tracking-tight">Post</h1>
        <p className="mt-2 text-sm text-white/50">Read the post and join the conversation.</p>
      </header>

      <ParticipationThreadPanel threadId={threadId} surface={surface} enabled showRoot />
      <div className="bvs-app-bottom-spacer" aria-hidden="true" />
    </main>
  );
}
