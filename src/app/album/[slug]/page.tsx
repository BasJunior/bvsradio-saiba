import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AlbumPlayer from '@/components/AlbumPlayer'
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
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/catalogue" className="text-sm text-brand">← Back to catalogue</Link>
      <div className="mt-8 grid gap-8 md:grid-cols-[320px_1fr]">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-black/30">
          <Image src={release.cover} alt={`${release.title} cover`} fill unoptimized={/^https?:\/\//i.test(release.cover)} className="object-contain" priority />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[.25em] text-brand">{release.releaseType} · BVS catalogue</p>
          <h1 className="mt-2 text-4xl font-semibold md:text-5xl">{release.title}</h1>
          <p className="mt-3 text-xl text-text-secondary">{release.artist}</p>
          <p className="mt-3 text-sm text-text-secondary">{release.genre || 'Music'} · {release.tracks.length} tracks{release.copyrightYear ? ` · © ${release.copyrightYear}` : ''}</p>
          {release.description && <p className="mt-5 max-w-prose text-text-secondary">{release.description}</p>}
        </div>
      </div>
      <div className="mt-10"><AlbumPlayer release={release} /></div>
    </main>
  )
}
