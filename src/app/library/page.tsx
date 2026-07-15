'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import LibraryAction from '@/components/LibraryAction'
import { readLibrary, type LibrarySection } from '@/lib/library'
import type { DiscoveryItem } from '@/lib/discovery'
import { useLibrarySync } from '@/components/LibrarySyncProvider'

const sections: Array<{ id: LibrarySection; label: string; empty: string }> = [
  { id: 'favourites', label: 'Saved', empty: 'Save tracks you want to find again.' },
  { id: 'follows', label: 'Following', empty: 'Follow artists as their BVS profiles go live.' },
  { id: 'history', label: 'History', empty: 'Tracks you open from BVS search will appear here.' },
]

export default function LibraryPage() {
  const [active, setActive] = useState<LibrarySection>('favourites')
  const [items, setItems] = useState<DiscoveryItem[]>([])
  const { state, signedIn, syncNow } = useLibrarySync()
  useEffect(() => {
    const sync = () => setItems(readLibrary(active)); sync()
    window.addEventListener('bvs:library-change', sync); window.addEventListener('storage', sync)
    return () => { window.removeEventListener('bvs:library-change', sync); window.removeEventListener('storage', sync) }
  }, [active])
  const current = sections.find((section) => section.id === active)!
  return <main className="mx-auto min-h-[70vh] max-w-5xl px-6 py-12">
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-brand">Your BVS</p><h1 className="text-4xl md:text-5xl">Library</h1>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
      <span>{!signedIn ? 'Saved on this device. Sign in to sync across devices.' : state === 'synced' ? 'Synced to your BVS account.' : state === 'syncing' ? 'Syncing your library…' : 'Saved locally; account sync needs attention.'}</span>
      {signedIn && state === 'error' && <button type="button" onClick={syncNow} className="text-brand hover:underline">Try again</button>}
      {!signedIn && <Link href="/auth/login" className="text-brand hover:underline">Sign in</Link>}
    </div>
    <div className="mt-8 flex gap-2 border-b border-white/10 pb-4">{sections.map((section) => <button key={section.id} onClick={() => setActive(section.id)} className={`rounded-full px-4 py-2 text-sm ${active === section.id ? 'bg-brand text-black' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}>{section.label}</button>)}</div>
    <div className="mt-6 space-y-3">{items.map((item) => <div key={item.id} className="flex items-center gap-4 rounded-xl border border-white/10 p-4"><Link href={item.href} className="min-w-0 flex-1"><h2 className="truncate font-medium">{item.title}</h2><p className="truncate text-sm text-text-secondary">{item.subtitle}</p></Link>{active !== 'history' && <LibraryAction item={item} section={active === 'follows' ? 'follows' : 'favourites'} compact />}</div>)}</div>
    {items.length === 0 && <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-12 text-center"><h2 className="text-xl">Your {current.label.toLowerCase()} will live here</h2><p className="mt-2 text-text-secondary">{current.empty}</p><Link href="/search" className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Discover BVS</Link></div>}
  </main>
}
