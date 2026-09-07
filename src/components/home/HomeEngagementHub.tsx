'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useStationPlayer } from '@/components/StationPlayer'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { readLibrary } from '@/lib/library'
import { trackEvent } from '@/lib/analytics'
import type { StationTrack } from '@/lib/station'

type CreatorCategory = 'listener' | 'artist' | 'producer' | 'writer' | 'show_creator'
type Move = { kicker: string; title: string; copy: string; href: string }

function dayKey() {
  return new Date().toISOString().slice(0, 10)
}

function dailyTracks(tracks: StationTrack[]) {
  const available = tracks.filter(track => Boolean(track.src))
  if (available.length <= 3) return available
  const seed = Number(dayKey().replaceAll('-', '')) || 1
  const start = seed % available.length
  const chosen: StationTrack[] = []
  for (let i = 0; i < available.length && chosen.length < 3; i += 1) {
    const track = available[(start + i * 7) % available.length]
    if (!chosen.some(item => (item.id || item.src) === (track.id || track.src))) chosen.push(track)
  }
  return chosen
}

function movesFor(category: CreatorCategory, likedBeats: number, hasHistory: boolean): Move[] {
  if (category === 'artist') return [
    { kicker: 'Create', title: 'Move your next release forward', copy: 'Open Studio and pick up the next action on your music.', href: '/creator/studio' },
    { kicker: 'Beats', title: likedBeats ? `${likedBeats} liked beat${likedBeats === 1 ? '' : 's'} waiting for you` : 'Find a beat worth writing to', copy: likedBeats ? 'Come back to the beats you saved while discovering.' : 'Preview producers and save ideas for your next record.', href: likedBeats ? '/library?section=saved-beats' : '/catalogue?type=beat#beatstore' },
    { kicker: 'Proof', title: 'Check what your music is doing', copy: 'See live release progress, plays and the next useful creator action.', href: '/creator/studio' },
  ]
  if (category === 'producer') return [
    { kicker: 'BeatStore', title: 'Keep your producer catalogue moving', copy: 'Manage beats and creator work from Studio.', href: '/creator/studio' },
    { kicker: 'Inspiration', title: likedBeats ? `Revisit ${likedBeats} beat${likedBeats === 1 ? '' : 's'} you liked` : 'See what other producers are making', copy: 'Use your Library as an idea bank, not just a listening list.', href: likedBeats ? '/library?section=saved-beats' : '/search?mode=beats' },
    { kicker: 'Listen', title: hasHistory ? 'Continue your BVS rotation' : 'Hear what artists are making now', copy: 'Stay connected to the music your production could live beside.', href: hasHistory ? '/library?section=recent' : '/radio' },
  ]
  if (category === 'writer') return [
    { kicker: 'Write', title: 'Open your next Lyrics Pad', copy: 'Start from a blank page or return to a licensed beat idea.', href: '/lyrics' },
    { kicker: 'Research', title: 'Follow the people behind the sound', copy: 'Discover artists, producers, shows and stories across BVS.', href: '/search?mode=creators' },
    { kicker: 'Listen', title: hasHistory ? 'Continue where you left off' : 'Listen for a story worth following', copy: 'Use the catalogue as research and inspiration.', href: hasHistory ? '/library?section=recent' : '/radio' },
  ]
  if (category === 'show_creator') return [
    { kicker: 'Show', title: 'Build the next programme', copy: 'Open Studio for your show and creator actions.', href: '/creator/studio' },
    { kicker: 'Listen', title: 'Find music for the conversation', copy: 'Explore tracks and artists you may want to follow on BVS.', href: '/search' },
    { kicker: 'Programme', title: 'See what is happening on BVS shows', copy: 'Follow the programme experience and current show pages.', href: '/shows' },
  ]
  return [
    { kicker: 'Listen', title: hasHistory ? 'Continue listening' : 'Start with the sound', copy: hasHistory ? 'Your recent BVS music is ready in Library.' : 'Drop into the live rotation and see what catches you.', href: hasHistory ? '/library?section=recent' : '/radio' },
    { kicker: 'Collect', title: 'Build a playlist', copy: 'Turn discoveries into a listening session that is yours.', href: '/library?section=playlists' },
    { kicker: 'Follow', title: 'Find someone worth following', copy: 'Keep artists and producers close as their BVS work grows.', href: '/search?mode=creators' },
  ]
}

export default function HomeEngagementHub() {
  const player = useStationPlayer()
  const [category, setCategory] = useState<CreatorCategory>('listener')
  const [signedIn, setSignedIn] = useState(false)
  const [likedBeats, setLikedBeats] = useState(0)
  const [hasHistory, setHasHistory] = useState(false)
  const [discovered, setDiscovered] = useState<string[]>([])

  useEffect(() => {
    const syncLibrary = () => {
      const favourites = readLibrary('favourites')
      setLikedBeats(favourites.filter(item => item.kind === 'beat').length)
      setHasHistory(readLibrary('history').length > 0)
    }
    syncLibrary()
    window.addEventListener('bvs:library-change', syncLibrary)
    const key = `bvs.activity.discover3.${dayKey()}`
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
      setDiscovered(Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : [])
    } catch { setDiscovered([]) }
    return () => window.removeEventListener('bvs:library-change', syncLibrary)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    let active = true
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      const session = data.session
      setSignedIn(Boolean(session))
      if (!session) {
        setCategory('listener')
        return
      }

      const metadata = session.user.user_metadata || {}
      const fallback = String(metadata.account_type || metadata.role || 'listener')
      const fallbackCategory = ['artist', 'producer', 'writer', 'show_creator'].includes(fallback) ? fallback as CreatorCategory : 'listener'
      setCategory(fallbackCategory)

      const profileResponse = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null)
      if (!active || !profileResponse?.ok) return
      const profile = await profileResponse.json().catch(() => ({})) as { creatorCategory?: string }
      if (profile.creatorCategory && ['artist', 'producer', 'writer', 'show_creator', 'listener'].includes(profile.creatorCategory)) {
        setCategory(profile.creatorCategory as CreatorCategory)
      }
    })
    return () => { active = false }
  }, [])

  const moves = useMemo(() => movesFor(category, likedBeats, hasHistory), [category, likedBeats, hasHistory])
  const discovery = useMemo(() => dailyTracks(player.tracks), [player.tracks])

  const playDiscovery = (track: StationTrack) => {
    const id = track.id || track.src
    player.playNow(track, { from: 'Discover 3 today', related: discovery.filter(item => (item.id || item.src) !== id) })
    const next = Array.from(new Set([...discovered, id]))
    setDiscovered(next)
    try { window.localStorage.setItem(`bvs.activity.discover3.${dayKey()}`, JSON.stringify(next)) } catch {}
    trackEvent('engagement_action_open', { activity: 'discover_3', track_id: track.id || null, progress: Math.min(3, next.length) })
  }

  return <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14" aria-labelledby="next-move-title">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Your BVS</p>
        <h2 id="next-move-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">There is always something worth doing next.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">Listen, collect, create or follow a thread. BVS adapts the next move to the way you use music.</p>
      </div>
      {!signedIn ? <Link href="/auth/signup" className="rounded-full border border-brand/30 px-5 py-2.5 text-sm font-semibold text-brand">Make it yours →</Link> : null}
    </div>

    <div className="mt-6 grid gap-3 md:grid-cols-3">
      {moves.map(move => <Link key={`${move.kicker}-${move.title}`} href={move.href} onClick={() => trackEvent('engagement_action_open', { activity: move.kicker.toLowerCase(), category })} className="group rounded-[1.45rem] border border-white/10 bg-white/[.025] p-5 transition hover:-translate-y-0.5 hover:border-brand/35 hover:bg-white/[.045]"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">{move.kicker}</p><h3 className="mt-2 text-xl font-semibold tracking-tight">{move.title}</h3><p className="mt-2 text-sm leading-relaxed text-text-secondary">{move.copy}</p><p className="mt-4 text-sm font-semibold text-brand">Open →</p></Link>)}
    </div>

    {discovery.length ? <div id="discover-three" className="mt-7 rounded-[1.6rem] border border-white/10 bg-black/10 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Daily discovery</p><h3 className="mt-2 text-2xl font-semibold">Discover 3 today.</h3><p className="mt-2 text-sm text-text-secondary">Three tracks from the current BVS catalogue. Hear all three and choose what deserves a place in your Library.</p></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-text-secondary">{Math.min(3, discovered.length)} / 3 heard</span></div>
      <div className="mt-5 grid gap-2 md:grid-cols-3">{discovery.map(track => { const id = track.id || track.src; const heard = discovered.includes(id); return <button key={id} type="button" onClick={() => playDiscovery(track)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${heard ? 'border-brand/25 bg-brand/[.06]' : 'border-white/10 bg-white/[.02] hover:border-brand/30'}`}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-brand">{heard ? '✓' : '▶'}</span><span className="min-w-0"><span className="block truncate font-semibold">{track.title}</span><span className="block truncate text-sm text-text-secondary">{track.artist}</span></span></button> })}</div>
    </div> : null}
  </section>
}
