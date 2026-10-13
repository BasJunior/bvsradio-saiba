import { NextResponse } from 'next/server'
import { beatHeaders, beatUrl, publicStorageUrl } from '@/lib/beatstore-server'
import { creatorPublicName } from '@/lib/public-name'
import type { StationTrack } from '@/lib/station'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type Beat = { id: string; title: string; producer_user_id: string; preview_path?: string; artwork_path?: string; genre?: string }

/** Resolve saved identities against current publication state, never cached audio. */
export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get('ids') || '').split(',').filter(Boolean))]
  if (!ids.length || ids.length > 50 || ids.some(id => !UUID.test(id))) return NextResponse.json({ error: 'Provide 1–50 valid beat IDs.' }, { status: 400 })
  try {
    const response = await fetch(beatUrl(`beats?id=in.(${ids.join(',')})&is_public=eq.true&status=eq.published&rights_confirmed=eq.true&select=id,title,producer_user_id,preview_path,artwork_path,genre`), { headers: beatHeaders, cache: 'no-store' })
    if (!response.ok) throw new Error('Beat catalogue unavailable')
    const beats = await response.json() as Beat[]
    const producerIds = [...new Set(beats.map(beat => beat.producer_user_id))]
    const profileResponse = producerIds.length ? await fetch(beatUrl(`profiles?id=in.(${producerIds.join(',')})&select=id,username,creator_public_name,creator_name_status`), { headers: beatHeaders, cache: 'no-store' }) : null
    const profiles = profileResponse?.ok ? await profileResponse.json() as Array<{ id: string; username: string; creator_public_name?: string; creator_name_status?: string }> : []
    const tracks: StationTrack[] = beats.flatMap(beat => {
      const src = publicStorageUrl(beat.preview_path)
      if (!src) return []
      const producer = profiles.find(profile => profile.id === beat.producer_user_id)
      return [{ id: `beat-${beat.id}`, kind: 'beat' as const, title: beat.title, artist: creatorPublicName({ publicName: producer?.creator_public_name, publicNameStatus: producer?.creator_name_status, username: producer?.username }) || 'BVS producer', src, artwork: publicStorageUrl(beat.artwork_path) || undefined, genre: beat.genre, project: 'BVS BeatStore' }]
    })
    return NextResponse.json({ tracks }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not load beat previews. Try again.' }, { status: 503 })
  }
}
