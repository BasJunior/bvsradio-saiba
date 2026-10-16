'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { rankMovement, type TrendingBoard } from '@/lib/trending'
export default function CreatorTrending({ token }: { token: string }) {
  const [result, setResult] = useState<{ token: string; boards: TrendingBoard[] } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/creator/trending', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' }).then(async r => r.ok ? r.json() : { boards: [] }).then(data => { if (!controller.signal.aborted) setResult({ token, boards: data.boards }) }).catch(() => {})
    return () => controller.abort()
  }, [token])
  const boards = result?.token === token ? result.boards : []
  if (!boards.some(board => board.entries.length)) return null
  return <div className="mb-6 border border-brand/25 p-4"><h3 className="font-semibold text-brand">Your music is moving</h3>{boards.map(board => board.entries.map(entry => <div key={`${board.window}:${entry.id}`} className="mt-3"><Link href={`/song/${entry.id}`} className="font-semibold">{entry.title} · Trending #{entry.rank}</Link><p className="text-xs text-brand">{board.window === 'now' ? 'Trending Now' : 'This Week'} · {rankMovement(entry.rank, entry.previousRank, board.hasPrevious)}</p><p className="mt-1 text-sm text-text-secondary">{entry.reason}</p></div>))}</div>
}
