import Image from "next/image";
import { notFound } from "next/navigation";
import AlbumPlayer from "@/components/AlbumPlayer";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import { getPublicRelease } from "@/lib/public-releases";

export const dynamic = "force-dynamic";

export default async function AppAlbumPage({ params }: { params: Promise<{ surface: string; id: string }> }) {
  const { surface, id } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  const release = await getPublicRelease(decodeURIComponent(id));
  if (!release) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-5 sm:px-6">
      <section className="grid gap-5 sm:grid-cols-[minmax(12rem,18rem)_1fr] sm:items-end">
        <div className="relative aspect-square overflow-hidden rounded-sm border border-white/10 bg-black/30">
          <Image src={release.cover} alt={`${release.title} cover`} fill unoptimized={/^https?:\/\//i.test(release.cover)} className="object-cover" priority />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">{release.releaseType} · BVS catalogue</p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">{release.title}</h1>
          <p className="mt-2 text-lg text-white/70">{release.artist}</p>
          <p className="mt-2 text-sm text-white/45">{release.genre || "Music"} · {release.tracks.length} tracks{release.copyrightYear ? ` · © ${release.copyrightYear}` : ""}</p>
          {release.description ? <p className="mt-4 max-w-prose text-sm leading-6 text-white/60">{release.description}</p> : null}
          <div className="mt-4"><AppShareButton title={release.title} text={`${release.title} by ${release.artist} on BVS Radio`} path={`/album/${encodeURIComponent(release.id)}`} image={release.cover} kicker="BVS Release" /></div>
        </div>
      </section>
      <section className="mt-7" aria-label="Release tracks"><AlbumPlayer release={release} /></section>
    </main>
  );
}
