'use client'

import { useEffect, useState } from 'react'
import type { DiscoveryItem } from '@/lib/discovery'
import { hasLibraryItem, toggleLibraryItem, type LibrarySection } from '@/lib/library'
import { trackEvent } from '@/lib/analytics'

export default function LibraryAction({ item, section = 'favourites', compact = false }: { item: DiscoveryItem; section?: Extract<LibrarySection, 'favourites' | 'follows'>; compact?: boolean }) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const sync = () => setSaved(hasLibraryItem(section, item.id))
    sync()
    window.addEventListener('bvs:library-change', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('bvs:library-change', sync); window.removeEventListener('storage', sync) }
  }, [item.id, section])

  const label = section === 'follows' ? (saved ? 'Following' : 'Follow') : (saved ? 'Saved' : 'Save')
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`${label} ${item.title}`}
      onClick={() => {
        const next = toggleLibraryItem(section, item)
        setSaved(next)
        if (next && section === 'favourites' && item.kind === 'track') trackEvent('track_save', { track_id: item.id })
      }}
      className={`rounded-full border transition ${saved ? 'border-brand bg-brand/15 text-brand' : 'border-white/20 text-text-secondary hover:border-brand hover:text-white'} ${compact ? 'px-3 py-1 text-xs' : 'px-5 py-2 text-sm'}`}
    >
      {section === 'favourites' ? (saved ? '♥ ' : '♡ ') : (saved ? '✓ ' : '+ ')}{label}
    </button>
  )
}
