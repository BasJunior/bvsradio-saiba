import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AlbumPlayer from '@/components/AlbumPlayer'
import ReleaseCoverPlay from '@/components/discovery/ReleaseCoverPlay'
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

  const credits = release.tracks.flatMap((track) =>
    track.credits.map((credit) => `${credit.person_name} — ${credit.credit_role.replaceAll('_', ' ')}`),
  )
  const uniqueCredits = Array.from(new Set(credits))
  const formatLabel = release.releaseType.replaceAll('_', ' ')

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16 pt-8 sm:pt-10">
      <Link href="/catalogue" className="text-sm text-brand">← Back to catalogue</Link>
      <div className="mt-8 grid gap-8 md:grid-cols-[320px_1fr]">
        <ReleaseCoverPlay release={release} />
        <div>
          <p className="text-xs uppercase tracking-[.25em] text-brand">{formatLabel} · BVS catalogue</p>
          <h1 className="mt-2 scroll-mt-28 text-4xl font-semibold md:text-5xl">{release.title}</h1>
          <p className="mt-3 text-xl text-text-secondary">{release.artist}</p>
          <p className="mt-3 text-sm text-text-secondary">
            Digital {formatLabel}
            {release.genre ? ` · ${release.genre}` : ''}
            {` · ${release.tracks.length} tracks`}
            {release.copyrightYear ? ` · © ${release.copyrightYear}` : ''}
          </p>
          {release.description && <p className="mt-5 max-w-prose text-text-secondary">{release.description}</p>}
          <div className="mt-6">
            <Link
              href={`/catalogue?q=${encodeURIComponent(release.title)}#browse`}
              className="text-sm font-semibold text-brand hover:underline"
            >
              Buy or license on BVS
            </Link>
          </div>
          {uniqueCredits.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Credits</h2>
              <ul className="mt-3 space-y-1 text-sm text-text-secondary">
                {uniqueCredits.slice(0, 12).map((credit) => (
                  <li key={credit}>{credit}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      <div className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Tracklist</h2>
        <AlbumPlayer release={release} />
      </div>
    </main>
  )
}
