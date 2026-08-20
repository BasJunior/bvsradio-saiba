'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics'

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
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
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
