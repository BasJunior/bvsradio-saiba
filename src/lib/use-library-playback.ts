'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DiscoveryItem } from '@/lib/discovery'
import type { StationTrack } from '@/lib/station'

export function libraryPlaybackId(item: DiscoveryItem) {
  return item.id.replace(/^(beat|track)-/, '')
}

/** Public previews are resolved by ID, including old beats saved as tracks. */
export function useLibraryPlayback(items: DiscoveryItem[], stationTracks: StationTrack[]) {
  const rotation = useMemo(() => new Map(stationTracks.filter(track => track.id && track.src).flatMap(track => [[track.id!, track], [track.id!.replace(/^track-/, ''), track]])), [stationTracks])
  const ids = [...new Set(items.filter(item => item.kind === 'beat' || (item.kind === 'track' && !rotation.has(item.id) && !rotation.has(libraryPlaybackId(item)))).map(libraryPlaybackId).filter(id => /^[0-9a-f-]{36}$/i.test(id)))].sort().join(',')
  const [result, setResult] = useState<{ ids: string; tracks: StationTrack[]; error: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!ids) return
    let alive = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    const values = ids.split(',')
    const batches = Array.from({ length: Math.ceil(values.length / 50) }, (_, index) => values.slice(index * 50, index * 50 + 50))
    void Promise.all(batches.map(async batch => {
      const response = await fetch(`/api/library/beat-previews?ids=${encodeURIComponent(batch.join(','))}`, { cache: 'no-store', signal: controller.signal })
      const payload = await response.json() as { tracks?: StationTrack[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not load beat previews.')
      return payload.tracks || []
    })).then(tracks => { if (alive) setResult({ ids, tracks: tracks.flat(), error: '' }) })
      .catch(() => { if (alive) setResult({ ids, tracks: [], error: 'Could not load beat previews. Try again.' }) })
      .finally(() => window.clearTimeout(timeout))
    return () => { alive = false; controller.abort(); window.clearTimeout(timeout) }
  }, [ids, attempt])
  const byId = useMemo(() => {
    const map = new Map(rotation)
    if (result?.ids === ids) for (const track of result.tracks) {
      if (!track.id || !track.src) continue
      map.set(track.id, track)
      map.set(track.id.replace(/^beat-/, ''), track)
    }
    return map
  }, [ids, result, rotation])
  return { byId, loading: Boolean(ids && result?.ids !== ids), error: result?.ids === ids ? result.error : '', retry: () => { setResult(null); setAttempt(value => value + 1) } }
}
