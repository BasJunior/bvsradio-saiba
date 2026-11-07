import { notFound } from "next/navigation";
import AlbumPlayer from "@/components/AlbumPlayer";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import DetailHero, { DetailSection } from "@/components/DetailHero";
import { getPublicRelease } from "@/lib/public-releases";

export const dynamic = "force-dynamic";

export default async function AppAlbumPage({ params }: { params: Promise<{ surface: string; id: string }> }) {
  const { surface, id } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  const release = await getPublicRelease(decodeURIComponent(id));
  if (!release) notFound();

  return (
    <main className="bvs-app-page bvs-detail-page mx-auto max-w-5xl px-4 pb-14 sm:px-6" data-app-accent="lime">
      <DetailHero
        image={release.cover}
        imageAlt={`${release.title} cover`}
        eyebrow={release.releaseType || "Release"}
        title={release.title}
        subtitle={release.artist}
        facts={[release.genre, `${release.tracks.length} song${release.tracks.length === 1 ? "" : "s"}`, release.copyrightYear ? `© ${release.copyrightYear}` : null]}
        actions={<AppShareButton title={release.title} text={`${release.title} by ${release.artist} on BVS Radio`} path={`/album/${encodeURIComponent(release.id)}`} image={release.cover} kicker="BVS Release" />}
      />
      {release.description ? <p className="mx-auto max-w-prose text-center text-sm leading-6 text-white/60 sm:mx-0 sm:text-left">{release.description}</p> : null}
      <DetailSection title="Songs" id="album-songs-heading"><AlbumPlayer release={release} /></DetailSection>
    </main>
  );
}
