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
    <main className="bvs-page-main mx-auto min-h-[100dvh] max-w-3xl px-4 pb-12 sm:px-6">
      <header className="pb-5 pt-6 sm:pb-7 sm:pt-8">
        <Link href={`/app/${surface}/feed`} className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-3 text-xs font-semibold text-white/48 transition hover:border-[#929DE0]/30 hover:text-white">
          ← Feed
        </Link>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.2em] text-[#929DE0]">BVS conversation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Conversation</h1>
        <p className="mt-2 text-sm leading-6 text-white/42">A stable BVS permalink for this post and its replies.</p>
      </header>

      <ParticipationThreadPanel threadId={threadId} surface={surface} enabled showRoot />
      <div className="bvs-app-bottom-spacer" aria-hidden="true" />
    </main>
  );
}
