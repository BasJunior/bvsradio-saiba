import Link from 'next/link'

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const collectionName = decodeURIComponent(slug).replace(/-/g, ' ')

  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <p className="mb-3 text-xs uppercase tracking-[3px] text-brand">Collection page</p>
      <h1 className="mb-5 text-4xl font-semibold capitalize">{collectionName}</h1>
      <div className="rounded-2xl border border-white/10 bg-bg-card/40 p-8">
        <span className="mb-4 inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[2px] text-brand">
          Catalogue in preparation
        </span>
        <p className="mx-auto max-w-xl text-text-secondary">
          This release does not have a verified track list or purchase offer yet. We have removed demo titles, invented prices and simulated purchase buttons until the rights-holder data and final audio are ready.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/catalogue" className="rounded-full bg-brand px-6 py-3 font-semibold text-black hover:bg-brand-dark">
            Browse available audio
          </Link>
          <Link href="/contact" className="rounded-full border border-white/20 px-6 py-3 font-semibold hover:bg-white/5">
            Ask about this release
          </Link>
        </div>
      </div>
    </div>
  )
}
