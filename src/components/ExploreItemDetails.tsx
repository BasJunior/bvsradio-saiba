'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef } from 'react'
import LibraryAction from '@/components/LibraryAction'
import { useStationPlayer } from '@/components/StationPlayer'
import { catalogueUnitPrice, offerLabel, priceBadge, rightsSummary } from '@/lib/catalogue-pricing'
import type { DiscoveryItem } from '@/lib/discovery'

export type ExploreDetailTrack = {
  id: string
  title: string
  position?: number
  src?: string
  credits?: Array<{ person_name: string; credit_role: string }>
}

export type ExploreDetail = {
  id: string
  kind: 'track' | 'beat' | 'release'
  title: string
  artist: string
  image?: string
  genre?: string
  collection?: string
  duration?: string
  description?: string
  bpm?: string
  mood?: string
  musicalKey?: string
  price?: number | null
  streamOnly?: boolean
  src?: string
  externalUrl?: string
  href: string
  actionHref?: string
  producerUsername?: string
  inRotation?: boolean
  albumPackage?: boolean
  releaseType?: string
  copyrightYear?: number
  publishedAt?: string
  tracks?: ExploreDetailTrack[]
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function canonicalLibraryId(kind: ExploreDetail['kind'], id: string) {
  const prefix = `${kind}-`
  return id.startsWith(prefix) ? id : `${prefix}${id}`
}

export default function ExploreItemDetails({
  detail,
  onClose,
}: {
  detail: ExploreDetail
  onClose: () => void
}) {
  const player = useStationPlayer()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => closeRef.current?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      window.requestAnimationFrame(() => returnFocusRef.current?.focus())
    }
  }, [onClose])

  const priced = useMemo(
    () => ({
      type: detail.kind === 'beat' ? 'beat' : detail.kind === 'release' ? 'mix' : 'single',
      price: detail.price,
      streamOnly: detail.streamOnly,
      collection: detail.collection,
      title: detail.title,
      albumPackage: detail.albumPackage,
    }),
    [detail],
  )
  const resolvedPrice = catalogueUnitPrice(priced)
  const hasExplicitCommerce =
    detail.kind !== 'release' || detail.price !== undefined || detail.streamOnly === true || detail.albumPackage === true
  const actionHref = detail.actionHref || detail.href
  const libraryItem: DiscoveryItem = {
    id: canonicalLibraryId(detail.kind, detail.id),
    kind: detail.kind,
    title: detail.title,
    subtitle: detail.artist,
    href: detail.href,
    image: detail.image,
  }

  const play = () => {
    if (!detail.src) return
    player.playNow(
      {
        id: detail.id,
        title: detail.title,
        artist: detail.artist,
        src: detail.src,
        artwork: detail.image,
        project: detail.collection || (detail.kind === 'beat' ? 'BVS BeatStore' : detail.kind === 'release' ? 'BVS Release' : 'Explore BVS'),
        genre: detail.genre,
      },
      { from: detail.kind === 'beat' ? 'BVS BeatStore' : detail.kind === 'release' ? 'BVS Release' : 'Explore BVS' },
    )
  }

  const playableReleaseTracks = useMemo(
    () => detail.kind === 'release' ? (detail.tracks || []).filter(track => Boolean(track.src)) : [],
    [detail],
  )

  const playRelease = () => {
    if (!playableReleaseTracks.length) return
    const tracks = playableReleaseTracks.map(track => ({
      id: track.id,
      title: track.title,
      artist: detail.artist,
      src: track.src!,
      artwork: detail.image,
      project: detail.title,
      genre: detail.genre,
    }))
    player.playAll(tracks, { from: `${detail.title} release` })
  }

  const meta = [
    detail.duration,
    detail.bpm && !String(detail.duration || '').includes('BPM') ? `${detail.bpm} BPM` : undefined,
    detail.musicalKey,
    detail.mood,
    detail.releaseType && detail.kind === 'release' ? detail.releaseType : undefined,
    detail.copyrightYear && detail.kind === 'release' ? `© ${detail.copyrightYear}` : undefined,
    detail.inRotation ? 'In BVS rotation' : undefined,
  ].filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-3 sm:p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explore-detail-title"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-bg-primary shadow-2xl"
      >
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-square bg-white/5">
            {detail.image ? (
              <Image
                src={detail.image}
                alt={`${detail.title} artwork`}
                fill
                unoptimized={/^https?:\/\//i.test(detail.image)}
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-5xl text-brand/50">♪</div>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/70 text-lg text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Close details"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col p-6 sm:p-7">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[2px] text-brand">
                {detail.genre || (detail.kind === 'beat' ? 'Beat' : detail.kind === 'release' ? 'Release' : 'Music')}
              </span>
              <span className="rounded bg-brand/10 px-2 py-1 text-[10px] tracking-widest text-brand">
                {detail.collection || (detail.kind === 'beat' ? 'BVS BeatStore' : detail.kind === 'release' ? 'Published release' : 'Published on BVS')}
              </span>
            </div>

            <h2 id="explore-detail-title" className="mb-2 text-4xl font-semibold">
              {detail.title}
            </h2>
            <p className="text-xl text-text-secondary">{detail.artist}</p>
            {meta.length ? <p className="mt-2 text-sm text-text-secondary">{meta.join(' · ')}</p> : null}
            <p className="mt-5 text-text-secondary">
              {detail.description || (detail.kind === 'beat'
                ? 'Published producer beat on BVS BeatStore.'
                : detail.kind === 'release'
                  ? 'Published BVS release. Open the full release when you want the complete tracklist and credits.'
                  : 'Published on BVS for listening and discovery.')}
            </p>

            {detail.kind === 'release' && detail.tracks?.length ? (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[.025] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[2px] text-brand">Tracklist</p>
                  <span className="text-xs text-text-secondary">{detail.tracks.length} tracks</span>
                </div>
                <ol className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                  {detail.tracks.map((track, index) => (
                    <li key={track.id} className="flex items-center gap-3 rounded-lg border border-white/5 px-3 py-2 text-sm">
                      <span className="w-5 shrink-0 text-right tabular-nums text-text-secondary">{track.position || index + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{track.title}</span>
                      {track.src ? <span className="text-[10px] uppercase tracking-wider text-brand">Playable</span> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {hasExplicitCommerce ? (
              <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[2px] text-brand">
                  {offerLabel(priced)}
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">{rightsSummary(priced)}</p>
                <p className="mt-2 text-xs font-semibold text-white/80">
                  {resolvedPrice === null ? 'Streaming / discovery' : priceBadge(priced)}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-5">
              {detail.kind === 'release' && playableReleaseTracks.length ? (
                <button
                  type="button"
                  onClick={playRelease}
                  className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black hover:bg-brand-dark"
                >
                  ▶ Play release
                </button>
              ) : detail.src ? (
                <button
                  type="button"
                  onClick={play}
                  className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black hover:bg-brand-dark"
                >
                  {detail.kind === 'beat' ? '▶ Preview beat' : detail.kind === 'release' ? '▶ Preview release' : '▶ Play on BVS'}
                </button>
              ) : null}

              <LibraryAction item={libraryItem} section="favourites" />

              <Link
                href={actionHref}
                data-flow-detail-skip="true"
                className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold hover:border-brand hover:text-brand"
              >
                {detail.kind === 'beat'
                  ? 'Licence options →'
                  : detail.kind === 'release'
                    ? 'Open full release →'
                    : resolvedPrice === null
                      ? 'Open catalogue →'
                      : 'Purchase options →'}
              </Link>

              {detail.kind === 'beat' && detail.producerUsername ? (
                <Link
                  href={`/artist/${encodeURIComponent(detail.producerUsername)}`}
                  data-flow-detail-skip="true"
                  className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-text-secondary hover:border-brand hover:text-white"
                >
                  Producer profile
                </Link>
              ) : null}

              {detail.externalUrl ? (
                <a
                  href={detail.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-flow-detail-skip="true"
                  className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-text-secondary hover:border-brand hover:text-white"
                >
                  Open stream ↗
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
