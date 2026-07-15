'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import LibraryAction from '@/components/LibraryAction'
import type { DiscoveryItem } from '@/lib/discovery'

const profiles: Record<string, { name: string; role: string; bio: string; image: string; catalogueQuery: string }> = {
  'bvs-radio': { name: 'BVS Radio', role: 'Station artist', bio: 'Original recordings and restored cuts from the BVS archive. Credits and release details will be expanded as the archive is documented.', image: '/music/Bvs-3000x3000%202.png', catalogueQuery: 'BVS' },
  wolfbrx: { name: 'WolfBrx', role: 'Producer', bio: 'Producer behind beats currently available in the BVS catalogue. This profile will grow with verified credits, releases and artist-provided links.', image: '/images/musicians.jpg', catalogueQuery: 'WolfBrx' },
}

export default function ArtistPage() {
  const slug = String(useParams().slug || '').toLowerCase()
  const profile = profiles[slug]
  if (!profile) return <main className="mx-auto min-h-[65vh] max-w-3xl px-6 py-16 text-center"><p className="text-xs uppercase tracking-[0.25em] text-brand">Artist profiles</p><h1 className="mt-3 text-4xl">This profile is not published yet</h1><p className="mx-auto mt-4 max-w-xl text-text-secondary">BVS is preparing verified artist pages as catalogue submissions arrive. We won’t fill the gap with invented tracks, numbers or credits.</p><div className="mt-8 flex justify-center gap-3"><Link href="/catalogue" className="rounded-full bg-brand px-5 py-2 font-semibold text-black">Browse music</Link><Link href="/upload" className="rounded-full border border-white/20 px-5 py-2">Submit music</Link></div></main>

  const item: DiscoveryItem = { id: `artist-${slug}`, kind: 'artist', title: profile.name, subtitle: profile.role, href: `/artist/${slug}`, image: profile.image }
  return <main className="mx-auto max-w-5xl px-6 py-12">
    <Link href="/search" className="text-sm text-brand">← Back to discovery</Link>
    <div className="mt-8 flex flex-col gap-10 md:flex-row">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 md:w-80"><Image src={profile.image} alt={profile.name} fill className="object-cover" priority /></div>
      <div className="flex-1"><p className="text-xs uppercase tracking-[0.25em] text-brand">{profile.role}</p><h1 className="mt-2 text-5xl">{profile.name}</h1><p className="mt-5 max-w-prose text-text-secondary">{profile.bio}</p><div className="mt-6"><LibraryAction item={item} section="follows" /></div>
        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6"><h2 className="text-xl">Music on BVS</h2><p className="mt-2 text-sm text-text-secondary">See the currently published catalogue entries. Listening totals are not shown until BVS has verified analytics.</p><Link href={`/catalogue?q=${encodeURIComponent(profile.catalogueQuery)}`} className="mt-5 inline-block text-sm font-semibold text-brand">View catalogue results →</Link></section>
      </div>
    </div>
  </main>
}
