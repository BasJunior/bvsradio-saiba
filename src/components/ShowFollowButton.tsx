'use client'

import { useEffect, useState } from 'react'
import { hasLibraryItem, toggleLibraryItem } from '@/lib/library'
import { trackEvent } from '@/lib/analytics'

export default function ShowFollowButton({ slug, title, subtitle, image }: { slug: string; title: string; subtitle: string; image?: string }) {
  const id = `show-${slug}`
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    const sync = () => setFollowing(hasLibraryItem('follows', id))
    sync()
    window.addEventListener('bvs:library-change', sync)
    return () => window.removeEventListener('bvs:library-change', sync)
  }, [id])

  return (
    <button
      type="button"
      aria-pressed={following}
      onClick={() => {
        const saved = toggleLibraryItem('follows', { id, kind: 'show', title, subtitle, href: `/shows/${slug}`, image })
        setFollowing(saved)
        trackEvent('show_follow', { show: slug, following: saved })
      }}
      className={following
        ? 'min-h-11 rounded-full border border-brand/40 bg-brand/10 px-5 font-semibold text-brand'
        : 'min-h-11 rounded-full bg-brand px-5 font-semibold text-black'}
    >
      {following ? 'Following show' : 'Follow show'}
    </button>
  )
}
