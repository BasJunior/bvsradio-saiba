'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import ShowVideo from '@/components/ShowVideo'
import { trackEvent } from '@/lib/analytics'

export default function ShowTvExperience({ slug, title, videoUrl, poster, replay }: { slug: string; title: string; videoUrl: string; poster?: string; replay: boolean }) {
  const [controlsVisible, setControlsVisible] = useState(true)
  const [companionUrl, setCompanionUrl] = useState('')
  const hideTimer = useRef<number | null>(null)

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 5_000)
  }, [])

  useEffect(() => {
    const setUrl = window.setTimeout(() => {
      const url = new URL(`/shows/${slug}`, window.location.origin).toString()
      setCompanionUrl(url)
      trackEvent('tv_companion_qr_shown', { show: slug })
    }, 0)
    trackEvent('tv_mode_enter', { show: slug, replay })
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 5_000)
    window.addEventListener('pointermove', revealControls)
    window.addEventListener('keydown', revealControls)
    return () => {
      window.clearTimeout(setUrl)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      window.removeEventListener('pointermove', revealControls)
      window.removeEventListener('keydown', revealControls)
    }
  }, [replay, revealControls, slug])

  return (
    <main className="fixed inset-0 z-[60] overflow-hidden bg-black text-white" onPointerDown={revealControls}>
      <div className="grid h-full place-items-center">
        <ShowVideo src={videoUrl} poster={poster} title={title} replay={replay} className="max-h-screen object-contain" />
      </div>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/75 transition-opacity duration-300 motion-reduce:transition-none ${controlsVisible ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
      <header className={`absolute inset-x-0 top-0 flex items-start justify-between gap-5 p-6 transition-opacity duration-300 motion-reduce:transition-none ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS TV</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-4xl">{title}</h1>
        </div>
        <Link href={`/shows/${slug}`} className="pointer-events-auto inline-flex min-h-11 items-center rounded-full border border-white/20 bg-black/40 px-5 font-semibold backdrop-blur hover:border-brand/50">Exit TV mode</Link>
      </header>
      {companionUrl ? (
        <aside className={`absolute bottom-6 right-6 hidden items-center gap-4 rounded-2xl border border-white/15 bg-black/70 p-4 backdrop-blur transition-opacity duration-300 motion-reduce:transition-none sm:flex ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <QRCodeSVG value={companionUrl} size={92} bgColor="#ffffff" fgColor="#090909" marginSize={1} title="Open this show on your phone" />
          <div className="max-w-40"><p className="font-semibold">Continue on phone</p><p className="mt-1 text-xs text-white/60">Open the public show page. The QR contains no login or private token.</p></div>
        </aside>
      ) : null}
    </main>
  )
}
