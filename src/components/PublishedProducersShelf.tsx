'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { PublishedProducerSummary } from '@/lib/artist-content'

export default function PublishedProducersShelf({ onBrowse }: { onBrowse: (producer: string) => void }) {
  const [producers, setProducers] = useState<PublishedProducerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/producers', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => setProducers(payload.producers || []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">Loading published producers…</p>
  if (failed) return <p className="rounded-xl border border-dashed border-red-400/20 p-5 text-sm text-red-200">Producer profiles could not be loaded. Refresh to try again.</p>
  if (!producers.length) return <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">No producers have a published BeatStore listing yet.</p>

  return <><div className="mb-5 flex justify-end"><Link href="/music/producers" className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">View all producers →</Link></div><div className="grid gap-4 md:grid-cols-3">
    {producers.map(producer => <article key={producer.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <div className="relative aspect-[16/9]"><Image src={producer.image} alt="" fill unoptimized={/^https?:\/\//i.test(producer.image)} className="object-cover transition group-hover:scale-[1.02]" /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" /></div>
      <div className="p-4"><p className="text-xs uppercase tracking-widest text-brand">Verified producer</p><h3 className="mt-1 text-lg font-semibold">{producer.name}</h3><p className="mt-2 text-sm text-text-secondary">{producer.beatCount} published {producer.beatCount === 1 ? 'beat' : 'beats'}{producer.genres.length ? ` · ${producer.genres.join(' · ')}` : ''}</p><div className="mt-4 flex gap-3 text-sm"><button type="button" onClick={() => onBrowse(producer.name)} className="text-brand">Browse beats →</button><Link href={`/artist/${producer.username}`} className="text-text-secondary hover:text-brand">Producer profile</Link></div></div>
    </article>)}
  </div></>
}
