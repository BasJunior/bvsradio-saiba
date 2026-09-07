import Link from 'next/link'

export default function LibraryLyricsShortcut() {
  return <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
    <Link href="/lyrics" className="group flex flex-wrap items-center justify-between gap-4 rounded-[1.45rem] border border-brand/20 bg-brand/[.045] px-5 py-4 transition hover:border-brand/35 hover:bg-brand/[.07]">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Private writing</p>
        <h2 className="mt-1 text-xl font-semibold">Lyrics Pad</h2>
        <p className="mt-1 text-sm text-text-secondary">Start a blank song for free or return to writing attached to a licensed beat.</p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-brand">Open Lyrics Pad →</span>
    </Link>
  </div>
}
