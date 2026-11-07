import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AlbumPlayer from '@/components/AlbumPlayer'
import DetailHero, { DetailSection } from '@/components/DetailHero'
import { getPublicRelease } from '@/lib/public-releases'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const release = await getPublicRelease(decodeURIComponent((await params).slug))
  if (!release) return { title: 'Release' }
  const description = `${release.title} by ${release.artist}. ${release.description || `A published ${release.releaseType} on BVS Radio.`}`.slice(0, 180)
  return { title: `${release.title} — ${release.artist}`, description, openGraph: { title: `${release.title} — ${release.artist} | BVS Radio`, description, images: release.cover ? [release.cover] : ['/logo.png'] } }
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const release = await getPublicRelease(decodeURIComponent(slug))
  if (!release) notFound()

  return (
    <main className="bvs-app-page bvs-detail-page mx-auto max-w-5xl px-4 pb-16 pt-2 sm:px-6" data-app-accent="lime">
      <Link href="/catalogue" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-white/60 hover:text-white"><span aria-hidden="true">‹</span> Catalogue</Link>
      <DetailHero
        image={release.cover}
        imageAlt={`${release.title} cover`}
        eyebrow={release.releaseType || 'Release'}
        title={release.title}
        subtitle={release.artist}
        facts={[release.genre, `${release.tracks.length} song${release.tracks.length === 1 ? '' : 's'}`, release.copyrightYear ? `© ${release.copyrightYear}` : null]}
      />
      {release.description ? <p className="mx-auto max-w-prose text-center text-sm leading-6 text-white/60 sm:mx-0 sm:text-left">{release.description}</p> : null}
      <DetailSection title="Songs" id="album-songs-heading"><AlbumPlayer release={release} /></DetailSection>
    </main>
  )
}
