
'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { creatorPublicName, producerPublicName } from '@/lib/public-name'

export type EditorialIdentityProfile = {
  id: string
  username?: string
  display_name?: string
  creator_public_name?: string
  creator_name_status?: string
  producer_public_name?: string
  producer_name_status?: string
  role?: string
  is_producer?: boolean
  is_published?: boolean
}

type Kind = 'track' | 'release' | 'beat'

function profileName(profile: EditorialIdentityProfile, kind: Kind) {
  if (kind === 'beat') {
    return producerPublicName({
      producerPublicName: profile.producer_public_name,
      producerNameStatus: profile.producer_name_status,
      publicName: profile.creator_public_name,
      publicNameStatus: profile.creator_name_status,
      username: profile.username,
    })
  }
  return creatorPublicName({
    publicName: profile.creator_public_name,
    publicNameStatus: profile.creator_name_status,
    username: profile.username,
  })
}

function PenIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 14.7 4.8 11 12.7 3.1a1.6 1.6 0 0 1 2.3 0l1.9 1.9a1.6 1.6 0 0 1 0 2.3L9 15.2 5.3 16Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m11.5 4.4 4.1 4.1" strokeLinecap="round" />
    </svg>
  )
}

export default function EditorialEditableIdentity({
  kind,
  id,
  title,
  artist,
  currentProfileId,
  profiles,
  editable,
  secondary,
}: {
  kind: Kind
  id: string
  title: string
  artist: string
  currentProfileId?: string
  profiles: EditorialIdentityProfile[]
  editable: boolean
  secondary?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [selectedProfileId, setSelectedProfileId] = useState(currentProfileId || '')
  const [customArtistName, setCustomArtistName] = useState(artist)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const candidates = useMemo(() => profiles.filter((profile) => {
    if (kind === 'beat') return Boolean(profile.is_producer) || profile.role === 'admin'
    return ['artist', 'admin'].includes(String(profile.role || '')) || Boolean(profile.is_producer)
  }), [kind, profiles])

  const save = async () => {
    if (!draftTitle.trim()) return
    if (kind === 'beat' && !selectedProfileId) {
      setError('Choose the BVS producer profile this beat belongs to.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Your editorial session expired. Sign in again.')
      const response = await fetch('/api/admin/editorial/catalogue-metadata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind,
          id,
          title: draftTitle.trim(),
          selectedProfileId,
          customArtistName: selectedProfileId ? '' : customArtistName.trim(),
        }),
      })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Could not save public metadata.')
      setEditing(false)
      window.location.reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save public metadata.')
    } finally {
      setSaving(false)
    }
  }

  const editButton = (label: string) => editable ? (
    <button type="button" onClick={() => setEditing(true)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-text-secondary transition hover:border-brand/50 hover:bg-brand/10 hover:text-brand" aria-label={label} title={label}>
      <PenIcon />
    </button>
  ) : null

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <h3 className="min-w-0 truncate text-xl font-semibold">{title}</h3>
        {editButton(`Edit title for ${title}`)}
      </div>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-text-secondary">
        <span className="truncate">{artist}</span>
        {editButton(`Edit artist relationship for ${title}`)}
        {secondary ? <span className="min-w-0">· {secondary}</span> : null}
      </div>

      {editing ? (
        <div className="mt-3 rounded-2xl border border-brand/25 bg-black/30 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-text-secondary">
              Public {kind === 'beat' ? 'beat' : kind === 'release' ? 'release' : 'track'} title
              <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} maxLength={180} className="mt-1 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand" />
            </label>
            <label className="text-xs text-text-secondary">
              Existing BVS {kind === 'beat' ? 'producer' : 'creator'} profile
              <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand">
                {kind !== 'beat' ? <option value="">Custom public name · keep current account relationship</option> : <option value="">Select producer profile</option>}
                {candidates.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profileName(profile, kind)} · @{profile.username || profile.id.slice(0, 8)}{profile.is_published ? ' · published' : ''}</option>
                ))}
              </select>
            </label>
          </div>
          {!selectedProfileId && kind !== 'beat' ? (
            <label className="mt-3 block text-xs text-text-secondary">
              Public artist name
              <input value={customArtistName} onChange={(event) => setCustomArtistName(event.target.value)} maxLength={160} className="mt-1 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand" />
              <span className="mt-1 block text-[11px]">Use this only when no BVS creator profile exists. The existing ownership relationship is preserved.</span>
            </label>
          ) : null}
          {selectedProfileId ? <p className="mt-3 text-[11px] leading-5 text-emerald-200">Saving uses the selected BVS profile’s approved public name and synchronizes the underlying account relationship automatically.</p> : null}
          {error ? <p className="mt-3 text-xs text-red-200">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={saving || !draftTitle.trim()} onClick={() => void save()} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">{saving ? 'Saving…' : 'Save public metadata'}</button>
            <button type="button" disabled={saving} onClick={() => { setEditing(false); setError('') }} className="rounded-full border border-white/15 px-4 py-2 text-xs">Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function EditorialReleaseTrackTitleEditor({
  releaseId,
  releaseTrackId,
  releaseTitle,
  releaseArtist,
  currentProfileId,
  title,
  editable,
}: {
  releaseId: string
  releaseTrackId: string
  releaseTitle: string
  releaseArtist: string
  currentProfileId?: string
  title: string
  editable: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!draft.trim()) return
    setSaving(true)
    setError('')
    try {
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Your editorial session expired. Sign in again.')
      const response = await fetch('/api/admin/editorial/catalogue-metadata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: 'release',
          id: releaseId,
          title: releaseTitle,
          selectedProfileId: currentProfileId || '',
          customArtistName: currentProfileId ? '' : releaseArtist,
          trackTitles: [{ releaseTrackId, title: draft.trim() }],
        }),
      })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Could not save track title.')
      setEditing(false)
      window.location.reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save track title.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 truncate">{title}</span>
        {editable ? <button type="button" onClick={() => setEditing(true)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-text-secondary hover:border-brand/50 hover:text-brand" aria-label={`Edit track title ${title}`} title="Edit track title"><PenIcon /></button> : null}
      </span>
    )
  }

  return (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={180} className="min-w-48 flex-1 rounded-lg border border-white/10 bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-brand" />
        <button type="button" disabled={saving || !draft.trim()} onClick={() => void save()} className="rounded-full bg-brand px-3 py-1.5 text-[11px] font-semibold text-black disabled:opacity-40">Save</button>
        <button type="button" disabled={saving} onClick={() => { setEditing(false); setDraft(title); setError('') }} className="rounded-full border border-white/15 px-3 py-1.5 text-[11px]">Cancel</button>
      </span>
      {error ? <span className="mt-1 block text-[11px] text-red-200">{error}</span> : null}
    </span>
  )
}
