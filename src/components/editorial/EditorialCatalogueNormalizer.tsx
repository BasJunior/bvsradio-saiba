'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { useStationPlayer } from '@/components/StationPlayer'

type Profile = {
  id: string
  username?: string
  display_name?: string
  public_name?: string
  role?: string
  is_producer?: boolean
  is_published?: boolean
}

type Track = {
  id: string
  user_id: string
  title: string
  artist_name: string
  genre?: string
  file_url?: string
  artwork_url?: string
  editorial_status: string
  is_public: boolean
  in_rotation: boolean
  created_at: string
  release_id?: string | null
  track_number?: number | null
}

type Release = {
  id: string
  user_id: string
  title: string
  artist_name: string
  genre?: string
  cover_url?: string
  release_type?: string
  editorial_status: string
  is_public: boolean
  in_rotation: boolean
  track_count?: number
  created_at: string
}

type ReleaseTrack = {
  id: string
  release_id: string
  track_id?: string | null
  position: number
  title: string
  file_url?: string
}

type Payload = {
  tracks: Track[]
  releases: Release[]
  releaseTracks: ReleaseTrack[]
  profiles: Profile[]
  identity: { role: string; permissions: string[] }
  error?: string
}

type Filter = 'all' | 'single' | 'ep' | 'album' | 'rotation'
type ViewMode = 'list' | 'grid'

type SaveBody = {
  kind: 'track' | 'release'
  id: string
  title: string
  selectedProfileId?: string
  customArtistName?: string
  trackTitles?: Array<{ releaseTrackId: string; title: string }>
}

function statusLabel(value?: string) {
  return String(value || 'draft').replaceAll('_', ' ')
}

function publicProfileName(profile?: Profile) {
  return String(profile?.public_name || profile?.display_name || profile?.username || 'BVS creator').trim()
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const remaining = whole % 60
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

function EditorialPreview({
  previewId,
  title,
  artist,
  src,
  artwork,
  project,
  genre,
}: {
  previewId: string
  title: string
  artist: string
  src?: string
  artwork?: string
  project?: string
  genre?: string
}) {
  const player = useStationPlayer()
  const id = `editorial-preview:${previewId}`
  const active = player.current?.id === id
  const elapsed = active ? player.elapsed : 0
  const duration = active ? player.duration : 0
  const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0

  if (!src) {
    return <div className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-xs text-text-secondary">No preview audio attached.</div>
  }

  const toggle = () => {
    if (active) {
      player.toggle()
      return
    }
    player.playNow({
      id,
      title,
      artist,
      src,
      artwork,
      project,
      genre,
      isDownloadable: false,
      licenceType: 'not_for_sale',
    }, { from: 'Editorial catalogue preview' })
  }

  return (
    <div className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[.055] px-3 py-2">
      <button
        type="button"
        onClick={toggle}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-sm font-black text-black"
        aria-label={`${active && player.isPlaying ? 'Pause' : 'Preview'} ${title}`}
      >
        {active && player.isPlaying ? 'Ⅱ' : '▶'}
      </button>
      <span className="w-11 shrink-0 text-right text-xs tabular-nums text-text-secondary">{formatTime(elapsed)}</span>
      <input
        type="range"
        min="0"
        max="1000"
        value={Math.round(progress * 1000)}
        disabled={!active || duration <= 0}
        onChange={(event) => player.seek(Number(event.target.value) / 1000)}
        className="min-w-0 flex-1 accent-brand disabled:opacity-45"
        aria-label={`Seek ${title}`}
      />
      <span className="w-11 shrink-0 text-xs tabular-nums text-text-secondary">{duration > 0 ? `-${formatTime(Math.max(0, duration - elapsed))}` : '0:00'}</span>
    </div>
  )
}

function CreatorRelationshipEditor({
  profiles,
  currentUserId,
  selectedProfileId,
  onProfileChange,
  customArtistName,
  onCustomArtistNameChange,
}: {
  profiles: Profile[]
  currentUserId: string
  selectedProfileId: string
  onProfileChange: (value: string) => void
  customArtistName: string
  onCustomArtistNameChange: (value: string) => void
}) {
  const currentProfile = profiles.find((profile) => profile.id === currentUserId)
  const selected = profiles.find((profile) => profile.id === selectedProfileId)
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">BVS creator relationship</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Select an existing BVS creator when possible. BVS will use that profile’s approved public name and keep the catalogue relationship attached to the account.
          </p>
        </div>
        {currentProfile ? (
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-text-secondary">Current · {publicProfileName(currentProfile)}</span>
        ) : null}
      </div>
      <label className="mt-3 block text-xs text-text-secondary">
        Existing BVS profile
        <select
          value={selectedProfileId}
          onChange={(event) => onProfileChange(event.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
        >
          <option value="">Custom display name · keep current account relationship</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {publicProfileName(profile)} · @{profile.username || profile.id.slice(0, 8)}{profile.is_published ? ' · published' : ''}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[.055] px-3 py-2 text-xs leading-5 text-emerald-100">
          Linked to <strong>{publicProfileName(selected)}</strong> · @{selected.username || selected.id.slice(0, 8)}. Saving updates the BVS creator relationship as well as the public artist label.
        </div>
      ) : (
        <label className="mt-3 block text-xs text-text-secondary">
          Public artist name
          <input
            value={customArtistName}
            onChange={(event) => onCustomArtistNameChange(event.target.value)}
            maxLength={160}
            placeholder="Exact public artist name"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
          />
          <span className="mt-1 block text-[11px] leading-5 text-text-secondary">Use this only when the artist does not yet have a BVS creator profile. The existing account relationship is preserved.</span>
        </label>
      )}
    </div>
  )
}

function SingleCard({
  track,
  profiles,
  onSave,
  busy,
}: {
  track: Track
  profiles: Profile[]
  onSave: (body: SaveBody) => Promise<void>
  busy: string
}) {
  const linkedProfile = profiles.find((profile) => profile.id === track.user_id)
  const [title, setTitle] = useState(track.title)
  const [selectedProfileId, setSelectedProfileId] = useState(linkedProfile?.id || '')
  const [artistName, setArtistName] = useState(track.artist_name)
  const dirty = title.trim() !== track.title || selectedProfileId !== (linkedProfile?.id || '') || (!selectedProfileId && artistName.trim() !== track.artist_name)
  const saveId = `track:${track.id}`

  return (
    <article className="flex h-full flex-col rounded-[1.65rem] border border-white/10 bg-white/[.025] p-5 shadow-[0_20px_60px_rgba(0,0,0,.18)]" data-editorial-id={track.id}>
      <div className="flex items-start gap-4">
        {track.artwork_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.artwork_url} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-white/10" />
        ) : (
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.025] text-[10px] text-text-secondary">No artwork</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-brand">Single{track.in_rotation ? ' · Rotation' : ''}{track.is_public ? ' · Public' : ''}</p>
          <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">{track.title}</h2>
          <p className="mt-1 truncate text-sm text-text-secondary">{track.artist_name}</p>
          <p className="mt-2 text-xs text-text-secondary">{track.genre || 'Music'} · {statusLabel(track.editorial_status)}</p>
        </div>
      </div>

      <div className="mt-5">
        <EditorialPreview previewId={`track:${track.id}`} title={track.title} artist={track.artist_name} src={track.file_url} artwork={track.artwork_url} genre={track.genre} />
      </div>

      <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
        <label className="block text-xs text-text-secondary">
          Public track title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-medium outline-none focus:border-brand"
          />
        </label>
        <CreatorRelationshipEditor
          profiles={profiles}
          currentUserId={track.user_id}
          selectedProfileId={selectedProfileId}
          onProfileChange={(value) => {
            setSelectedProfileId(value)
            const selected = profiles.find((profile) => profile.id === value)
            if (selected) setArtistName(publicProfileName(selected))
          }}
          customArtistName={artistName}
          onCustomArtistNameChange={setArtistName}
        />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <p className="text-[11px] leading-5 text-text-secondary">Track ID, audio, rights, ISRC and rotation state stay unchanged.</p>
        <button
          type="button"
          disabled={!dirty || !title.trim() || (!selectedProfileId && !artistName.trim()) || Boolean(busy)}
          onClick={() => onSave({ kind: 'track', id: track.id, title, selectedProfileId, customArtistName: artistName })}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === saveId ? 'Saving…' : 'Save public metadata'}
        </button>
      </div>
    </article>
  )
}

function ReleaseCard({
  release,
  members,
  catalogueTracks,
  profiles,
  onSave,
  busy,
}: {
  release: Release
  members: ReleaseTrack[]
  catalogueTracks: Track[]
  profiles: Profile[]
  onSave: (body: SaveBody) => Promise<void>
  busy: string
}) {
  const linkedProfile = profiles.find((profile) => profile.id === release.user_id)
  const [title, setTitle] = useState(release.title)
  const [selectedProfileId, setSelectedProfileId] = useState(linkedProfile?.id || '')
  const [artistName, setArtistName] = useState(release.artist_name)
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>(() => Object.fromEntries(members.map((member) => [member.id, member.title])))
  const changedSongTitles = members.some((member) => (trackTitles[member.id] || '').trim() !== member.title)
  const dirty = title.trim() !== release.title || selectedProfileId !== (linkedProfile?.id || '') || (!selectedProfileId && artistName.trim() !== release.artist_name) || changedSongTitles
  const saveId = `release:${release.id}`
  const releaseType = String(release.release_type || (members.length <= 1 ? 'single' : 'album')).toUpperCase()

  return (
    <article className="flex h-full flex-col rounded-[1.65rem] border border-white/10 bg-white/[.025] p-5 shadow-[0_20px_60px_rgba(0,0,0,.18)]" data-editorial-id={release.id}>
      <div className="flex items-start gap-4">
        {release.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={release.cover_url} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-white/10" />
        ) : (
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.025] text-[10px] text-text-secondary">No cover</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-brand">{releaseType}{release.in_rotation ? ' · Rotation' : ''}{release.is_public ? ' · Public' : ''}</p>
          <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">{release.title}</h2>
          <p className="mt-1 truncate text-sm text-text-secondary">{release.artist_name}</p>
          <p className="mt-2 text-xs text-text-secondary">{release.genre || 'Music'} · {members.length || release.track_count || 0} tracks · {statusLabel(release.editorial_status)}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {members.map((member) => {
          const materialized = member.track_id ? catalogueTracks.find((track) => track.id === member.track_id) : undefined
          return (
            <div key={member.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <div className="mb-2 flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-[11px] text-text-secondary">{member.position}</span>
                <input
                  value={trackTitles[member.id] ?? member.title}
                  onChange={(event) => setTrackTitles((current) => ({ ...current, [member.id]: event.target.value }))}
                  maxLength={180}
                  aria-label={`Public title for track ${member.position}`}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium outline-none transition focus:border-brand/40 focus:bg-black/20"
                />
                {materialized?.in_rotation ? <span className="rounded-full border border-brand/20 px-2 py-1 text-[10px] uppercase tracking-wider text-brand">Rotation</span> : null}
              </div>
              <EditorialPreview
                previewId={`release:${release.id}:${member.id}`}
                title={trackTitles[member.id] || member.title}
                artist={release.artist_name}
                src={member.file_url || materialized?.file_url}
                artwork={release.cover_url}
                project={release.title}
                genre={release.genre}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
        <label className="block text-xs text-text-secondary">
          Public release title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-medium outline-none focus:border-brand"
          />
        </label>
        <CreatorRelationshipEditor
          profiles={profiles}
          currentUserId={release.user_id}
          selectedProfileId={selectedProfileId}
          onProfileChange={(value) => {
            setSelectedProfileId(value)
            const selected = profiles.find((profile) => profile.id === value)
            if (selected) setArtistName(publicProfileName(selected))
          }}
          customArtistName={artistName}
          onCustomArtistNameChange={setArtistName}
        />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <p className="text-[11px] leading-5 text-text-secondary">Release/track IDs, files, rights evidence and ISRCs stay untouched. Materialized songs are synchronized automatically.</p>
        <button
          type="button"
          disabled={!dirty || !title.trim() || (!selectedProfileId && !artistName.trim()) || members.some((member) => !(trackTitles[member.id] || '').trim()) || Boolean(busy)}
          onClick={() => onSave({
            kind: 'release',
            id: release.id,
            title,
            selectedProfileId,
            customArtistName: artistName,
            trackTitles: members.map((member) => ({ releaseTrackId: member.id, title: trackTitles[member.id] || member.title })),
          })}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === saveId ? 'Saving…' : 'Save release metadata'}
        </button>
      </div>
    </article>
  )
}

export default function EditorialCatalogueNormalizer() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('list')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('bvs.editorial.catalogue.view.v1')
      if (saved === 'grid' || saved === 'list') setView(saved)
    } catch {}
  }, [])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sign in with an Editorial account.')
      const response = await fetch('/api/admin/editorial/catalogue-metadata', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const body = await response.json() as Payload
      if (!response.ok) throw new Error(body.error || 'Could not load Editorial catalogue metadata.')
      setPayload(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Editorial catalogue metadata.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (body: SaveBody) => {
    const busyId = `${body.kind}:${body.id}`
    setBusy(busyId)
    setError('')
    setNotice('')
    try {
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Your Editorial session expired.')
      const response = await fetch('/api/admin/editorial/catalogue-metadata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: string; relationshipChanged?: boolean; updatedTrackTitles?: number }
      if (!response.ok) throw new Error(result.error || 'Could not save public metadata.')
      setNotice(result.relationshipChanged
        ? 'Saved. The public metadata and BVS creator relationship were updated together.'
        : 'Saved. Public metadata is synchronized across the BVS catalogue.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save public metadata.')
    } finally {
      setBusy('')
    }
  }

  const catalogueTracks = payload?.tracks || []
  const standaloneTracks = catalogueTracks.filter((track) => !track.release_id)
  const releases = payload?.releases || []
  const releaseTracks = payload?.releaseTracks || []
  const profiles = payload?.profiles || []

  const items = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const rows: Array<{ key: string; kind: 'track' | 'release'; createdAt: string; track?: Track; release?: Release }> = [
      ...standaloneTracks.map((track) => ({ key: `track:${track.id}`, kind: 'track' as const, createdAt: track.created_at, track })),
      ...releases.map((release) => ({ key: `release:${release.id}`, kind: 'release' as const, createdAt: release.created_at, release })),
    ]
    return rows
      .filter((row) => {
        if (row.track) {
          if (filter === 'ep' || filter === 'album') return false
          if (filter === 'rotation' && !row.track.in_rotation) return false
          if (filter === 'single' || filter === 'all' || filter === 'rotation') {
            if (!normalizedQuery) return true
            return [row.track.title, row.track.artist_name, row.track.genre, row.track.editorial_status]
              .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
          }
          return false
        }
        const release = row.release as Release
        const type = String(release.release_type || '').toLowerCase()
        if (filter === 'single' && type !== 'single') return false
        if (filter === 'ep' && type !== 'ep') return false
        if (filter === 'album' && type !== 'album') return false
        if (filter === 'rotation' && !release.in_rotation) return false
        if (normalizedQuery) {
          const memberNames = releaseTracks.filter((member) => member.release_id === release.id).map((member) => member.title).join(' ')
          return [release.title, release.artist_name, release.genre, release.release_type, release.editorial_status, memberNames]
            .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
        }
        return true
      })
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
  }, [filter, query, releaseTracks, releases, standaloneTracks])

  const setViewMode = (next: ViewMode) => {
    setView(next)
    try { window.localStorage.setItem('bvs.editorial.catalogue.view.v1', next) } catch {}
  }

  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 pb-28 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Editorial · Catalogue normalization</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">One public format for every release.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary">
            Normalize singles, EPs and albums without changing the underlying recording identity. Existing BVS creators can be linked directly from the database so public names and account relationships stay consistent across rotation and catalogue surfaces.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/editorial" className="rounded-full border border-white/15 px-4 py-2 text-sm">Editorial workflow</Link>
          <button type="button" onClick={() => void load()} className="rounded-full border border-brand/30 px-4 py-2 text-sm text-brand">Refresh</button>
        </div>
      </div>

      <section className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[.025] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['all', 'All'],
            ['single', 'Singles'],
            ['ep', 'EPs'],
            ['album', 'Albums'],
            ['rotation', 'Rotation'],
          ] as Array<[Filter, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-2 text-sm transition ${filter === value ? 'bg-brand font-semibold text-black' : 'border border-white/10 text-text-secondary hover:border-white/20 hover:text-text-primary'}`}
            >
              {label}
            </button>
          ))}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search artist, title, genre…"
            className="min-h-10 min-w-[15rem] flex-1 rounded-full border border-white/10 bg-black/20 px-4 text-sm outline-none focus:border-brand"
          />
          <div className="ml-auto flex rounded-full border border-white/10 p-1" aria-label="Catalogue view">
            <button type="button" onClick={() => setViewMode('list')} aria-pressed={view === 'list'} className={`rounded-full px-3 py-1.5 text-xs ${view === 'list' ? 'bg-white/10 text-white' : 'text-text-secondary'}`}>List</button>
            <button type="button" onClick={() => setViewMode('grid')} aria-pressed={view === 'grid'} className={`rounded-full px-3 py-1.5 text-xs ${view === 'grid' ? 'bg-white/10 text-white' : 'text-text-secondary'}`}>Grid</button>
          </div>
        </div>
      </section>

      {error ? <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}
      {notice ? <p className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.055] p-4 text-sm text-emerald-100">{notice}</p> : null}

      {loading && !payload ? (
        <div className="mt-8 rounded-3xl border border-white/10 p-12 text-center text-text-secondary">Loading Editorial catalogue…</div>
      ) : null}

      {!loading && payload && items.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-white/10 p-12 text-center text-text-secondary">No catalogue items match this view.</div>
      ) : null}

      {payload ? (
        <section className={`mt-8 ${view === 'grid' ? 'grid gap-5 xl:grid-cols-2' : 'space-y-5'}`}>
          {items.map((item) => item.track ? (
            <SingleCard key={item.key} track={item.track} profiles={profiles} onSave={save} busy={busy} />
          ) : item.release ? (
            <ReleaseCard
              key={item.key}
              release={item.release}
              members={releaseTracks.filter((member) => member.release_id === item.release?.id)}
              catalogueTracks={catalogueTracks}
              profiles={profiles}
              onSave={save}
              busy={busy}
            />
          ) : null)}
        </section>
      ) : null}
    </main>
  )
}
