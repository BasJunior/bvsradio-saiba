'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import ShowVideo from '@/components/ShowVideo'
import { trackEvent } from '@/lib/analytics'

export default function ShowTvExperience({
  slug,
  title,
  videoUrl,
  poster,
  replay,
  phaseLabel,
  currentTitle,
  currentArtist,
}: {
  slug: string
  title: string
  videoUrl: string
  poster?: string
  replay: boolean
  phaseLabel: string
  currentTitle?: string
  currentArtist?: string
}) {
  const router = useRouter()
  const rootRef = useRef<HTMLElement>(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [companionUrl, setCompanionUrl] = useState('')
  const hideTimer = useRef<number | null>(null)

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 5_000)
  }, [])

  const moveFocus = useCallback((direction: -1 | 1) => {
    const root = rootRef.current
    if (!root) return
    const controls = Array.from(
      root.querySelectorAll<HTMLElement>('video[controls],a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'),
    ).filter(node => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true')
    if (!controls.length) return
    const active = document.activeElement as HTMLElement | null
    const currentIndex = active ? controls.indexOf(active) : -1
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + direction + controls.length) % controls.length
    controls[nextIndex]?.focus()
  }, [])

  useEffect(() => {
    const setUrl = window.setTimeout(() => {
      const url = new URL(`/shows/${slug}?join=room#room`, window.location.origin).toString()
      setCompanionUrl(url)
      trackEvent('tv_companion_qr_shown', { show: slug })
    }, 0)
    trackEvent('tv_mode_enter', { show: slug, replay })
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 5_000)

    const onKeyDown = (event: KeyboardEvent) => {
      revealControls()
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        router.push(`/shows/${slug}`)
        return
      }

      const active = document.activeElement as HTMLElement | null
      if (active?.tagName === 'VIDEO') return

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        moveFocus(-1)
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        moveFocus(1)
      }
    }

    window.addEventListener('pointermove', revealControls)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(setUrl)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      window.removeEventListener('pointermove', revealControls)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [moveFocus, replay, revealControls, router, slug])

  return (
    <main ref={rootRef} className="fixed inset-0 z-[60] overflow-hidden bg-black text-white" onPointerDown={revealControls}>
      <div className="grid h-full place-items-center">
        <ShowVideo src={videoUrl} poster={poster} title={title} replay={replay} className="max-h-screen object-contain focus:outline-none focus-visible:ring-4 focus-visible:ring-brand" />
      </div>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/80 transition-opacity duration-300 motion-reduce:transition-none ${controlsVisible ? 'opacity-100' : 'opacity-45'}`} aria-hidden="true" />

      <header className={`absolute inset-x-0 top-0 flex items-start justify-between gap-5 p-6 sm:p-8 lg:p-10 transition-opacity duration-300 motion-reduce:transition-none ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.24em] text-brand">{phaseLabel} · BVS TV</p>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{title}</h1>
        </div>
        <Link
          href={`/shows/${slug}`}
          className="pointer-events-auto inline-flex min-h-14 items-center rounded-full border border-white/25 bg-black/55 px-7 text-lg font-semibold backdrop-blur hover:border-brand/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand"
        >
          Exit TV mode
        </Link>
      </header>

      <section className="pointer-events-none absolute bottom-8 left-7 max-w-[68vw] sm:bottom-10 sm:left-10" aria-live="polite">
        {currentTitle || currentArtist ? (
          <div className="rounded-2xl bg-black/45 px-5 py-4 backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-[.2em] text-brand">{replay ? 'From this show' : 'Now in the set'}</p>
            {currentTitle ? <h2 className="mt-1 text-3xl font-semibold leading-tight sm:text-5xl">{currentTitle}</h2> : null}
            {currentArtist ? <p className="mt-1 text-xl text-white/75 sm:text-2xl">{currentArtist}</p> : null}
          </div>
        ) : null}
      </section>

      {companionUrl ? (
        <aside className={`absolute bottom-8 right-8 hidden items-center gap-5 rounded-2xl border border-white/15 bg-black/75 p-5 backdrop-blur transition-opacity duration-300 motion-reduce:transition-none md:flex ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <QRCodeSVG value={companionUrl} size={120} bgColor="#ffffff" fgColor="#090909" marginSize={1} title="Join this BVS show on your phone" />
          <div className="max-w-52">
            <p className="text-lg font-semibold">Join on your phone</p>
            <p className="mt-2 text-sm leading-relaxed text-white/65">React, follow creators and join the room without putting chat over the performance. The QR carries no login or private token.</p>
          </div>
        </aside>
      ) : null}
    </main>
  )
}
