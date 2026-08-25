'use client'

import Hls from 'hls.js'
import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics'

function isHlsSource(src: string) {
  try {
    return new URL(src, window.location.origin).pathname.toLowerCase().endsWith('.m3u8')
  } catch {
    return src.toLowerCase().includes('.m3u8')
  }
}

export default function ShowVideo({
  src,
  poster,
  title,
  replay = false,
  className = '',
}: {
  src: string
  poster?: string
  title: string
  replay?: boolean
  className?: string
}) {
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const element = video.current
    if (!element) return

    let hls: Hls | null = null
    const hlsSource = isHlsSource(src)
    const nativeHls = Boolean(
      element.canPlayType('application/vnd.apple.mpegurl') ||
      element.canPlayType('application/x-mpegURL'),
    )

    if (hlsSource && !nativeHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      })
      hls.loadSource(src)
      hls.attachMedia(element)
    } else {
      // Safari/iOS use native HLS. Non-HLS replay URLs keep the normal video path.
      element.src = src
    }

    return () => {
      hls?.destroy()
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
  }, [src])

  useEffect(() => {
    const releaseVideo = (event: Event) => {
      const owner = (event as CustomEvent<{ owner?: string }>).detail?.owner
      if (owner === 'station' && video.current && !video.current.paused) video.current.pause()
    }
    window.addEventListener('bvs:audio-claim', releaseVideo)
    return () => window.removeEventListener('bvs:audio-claim', releaseVideo)
  }, [])

  return (
    <video
      ref={video}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      aria-label={title}
      className={`aspect-video w-full bg-black ${className}`}
      onPlay={() => {
        window.dispatchEvent(new CustomEvent('bvs:audio-claim', { detail: { owner: 'show-video' } }))
        if (replay) trackEvent('show_replay_start', { title })
      }}
    >
      Your browser does not support BVS show video.
    </video>
  )
}
