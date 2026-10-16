'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { TrendingBoard } from '@/lib/trending'
import { rankMovement } from '@/lib/trending'
let cached: Promise<TrendingBoard | null> | null = null
let loadedAt = 0
export default function TrendingBadge({ trackId, surface }: { trackId: string; surface?: 'ios' | 'android' }) {
  const [board, setBoard] = useState<TrendingBoard | null>(null)
  useEffect(() => {
    let live = true
    if (!cached || Date.now() - loadedAt > 60000) {
      loadedAt = Date.now()
      cached = fetch('/api/trending?window=now').then(r => r.ok ? r.json() : null).catch(() => null)
    }
    cached!.then(value => { if (live) setBoard(value) })
    return () => { live = false }
  }, [trackId])
  const entry = board?.entries.find(row => row.id === trackId)
  if (!entry || !board) return null
  return <Link href={surface ? `/app/${surface}/trending` : '/trending'} className="mt-2 inline-flex min-h-8 items-center gap-2 border border-brand/25 px-2 text-xs text-brand">Trending #{entry.rank} <span>{rankMovement(entry.rank, entry.previousRank, board.hasPrevious)}</span></Link>
}
