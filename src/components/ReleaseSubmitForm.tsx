'use client'

import { useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { isAllowedAudioFile } from '@/lib/audio-formats'
import { trackEvent } from '@/lib/analytics'

type Slot = { path: string; signedUrl: string; contentType: string; index?: number }
type WorkspaceContext = { id: string; songTitle?: string; beatTitle: string; producerName: string; licenceSummary: string; licenceCode: string }

async function putToSignedSlot(slot: Slot, file: File) {
  const res = await fetch(slot.signedUrl, { method: 'PUT', headers: { 'Content-Type': slot.contentType || file.type || 'application/octet-stream' }, body: file })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
}

const genres = ['Hip-Hop', 'Trap', 'Afrobeats', 'Amapiano', 'R&B', 'Dancehall', 'Electronic', 'Lofi', 'Gospel', 'Jazz', 'Pop', 'Sungura', 'Zimdancehall', 'Chimurenga', 'Other']
const materialOptions = [
  ['original', 'Fully original'], ['cover', 'Cover song'], ['remix', 'Remix'], ['sample', 'Contains samples'],
  ['leased_beat', 'Uses a leased beat'], ['other_third_party', 'Other third-party material'],
] as const

function xml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char] || char))
}

function bvsLicenceEvidence(workspace: WorkspaceContext) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><rect width="1200" height="700" fill="#0b0b0b"/><text x="70" y="110" fill="#f6c900" font-size="34" font-family="Arial">BVS BEAT LICENCE RECORD</text><text x="70" y="190" fill="white" font-size="46" font-family="Arial">${xml(workspace.beatTitle)}</text><text x="70" y="250" fill="#bbbbbb" font-size="28" font-family="Arial">Producer: ${xml(workspace.producerName)}</text><text x="70" y="305" fill="#bbbbbb" font-size="26" font-family="Arial">Licence: ${xml(workspace.licenceCode.replaceAll('_', ' '))}</text><text x="70" y="380" fill="#dddddd" font-size="22" font-family="Arial">Verified from paid BVS purchase and Song Workspace entitlement.</text><text x="70" y="435" fill="#888888" font-size="20" font-family="Arial">Workspace ${xml(workspace.id)}</text></svg>`
  return new File([svg], `bvs-beat-licence-${workspace.id}.svg`, { type: 'image/svg+xml' })
}

export default function ReleaseSubmitForm({ onSuccess, songWorkspaceId }: { onSuccess?: () => void; songWorkspaceId?: string }) {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [releaseType, setReleaseType] = useState('album')
  const [files, setFiles] = useState<File[]>([])
  const [trackTitles, setTrackTitles] = useState<string[]>([])
  const [cover, setCover] = useState<File | null>(null)
  const [rights, setRights] = useState(false)
  const [explicit, setExplicit] = useState(false)
  const [explicitDeclared, setExplicitDeclared] = useState(false)
  const [copyrightYear, setCopyrightYear] = useState(String(new Date().getFullYear()))
  const [masterOwner, setMasterOwner] = useState('')
  const [compositionOwners, setCompositionOwners] = useState('')
  const [songwriters, setSongwriters] = useState('')
  const [producers, setProducers] = useState('')
  const [featuredArtists, setFeaturedArtists] = useState('')
  const [materialTypes, setMaterialTypes] = useState<string[]>(['original'])
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, File | null>>({})
  const [evidenceNotes, setEvidenceNotes] = useState<Record<string, string>>({})
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!songWorkspaceId || !isSupabaseConfigured()) return
    createClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token
      if (!token) return
      const response = await fetch(`/api/creator/song-workspaces/${encodeURIComponent(songWorkspaceId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) return setError(payload.error || 'Could not attach the purchased beat licence.')
      const context = payload.workspace as WorkspaceContext
      setWorkspaceContext(context)
      setTitle((current) => current || context.songTitle || '')
      setReleaseType('single')
      setProducers((current) => current || context.producerName || '')
      setMaterialTypes(['leased_beat'])
    }).catch(() => setError('Could not attach the purchased beat licence.'))
  }, [songWorkspaceId])

  const autoLicensedBeat = Boolean(songWorkspaceId && workspaceContext)

  const onFiles = (list: FileList | null) => {
    setError(null)
    if (!list?.length) { setFiles([]); setTrackTitles([]); return }
    const next: File[] = []
    for (const file of Array.from(list)) {
      const check = isAllowedAudioFile(file)
      if (!check.ok) return setError(check.error || 'Unsupported file')
      next.push(file)
    }
    if (next.length > 30) return setError('Maximum 30 tracks per release.')
    setFiles(next)
    setTrackTitles(next.map((f, index) => index === 0 && title.trim() ? title.trim() : f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !genre || !files.length || !cover || !rights || !explicitDeclared) return setError('Title, genre, cover art, tracks, rights confirmation and explicit-status declaration are required.')
    if (!masterOwner.trim() || !compositionOwners.trim() || !songwriters.trim() || !producers.trim()) return setError('Name the master owner, composition owner, songwriter and producer before submitting.')
    const requiredEvidenceTypes = materialTypes.filter((type) => type !== 'original')
    if (!materialTypes.length || requiredEvidenceTypes.some((type) => !(type === 'leased_beat' && autoLicensedBeat) && !evidenceFiles[type])) return setError('Declare the material type and upload clearance evidence for every cover, remix, sample, leased beat or third-party element not already licensed through BVS.')
    if (!isSupabaseConfigured()) return setError('Account service not configured.')
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!userData.user || !session?.access_token) throw new Error('Sign in before submitting a release.')
      const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      const evidenceEntries = requiredEvidenceTypes.map((materialType) => ({
        materialType,
        file: materialType === 'leased_beat' && autoLicensedBeat && workspaceContext ? bvsLicenceEvidence(workspaceContext) : evidenceFiles[materialType] as File,
      }))

      setProgress('Preparing secure upload slots…')
      const prepRes = await fetch('/api/releases/prepare', { method: 'POST', headers, body: JSON.stringify({
        tracks: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        cover: cover ? { name: cover.name, type: cover.type, size: cover.size } : null,
        evidence: evidenceEntries.map(({ materialType, file }) => ({ materialType, name: file.name, type: file.type, size: file.size })),
      }) })
      const prep = await prepRes.json()
      if (!prepRes.ok) throw new Error(prep.error || 'Prepare failed')
      for (let i = 0; i < files.length; i++) { setProgress(`Uploading track ${i + 1} of ${files.length}…`); await putToSignedSlot(prep.tracks[i] as Slot, files[i]) }
      if (cover && prep.cover) { setProgress('Uploading cover…'); await putToSignedSlot(prep.cover as Slot, cover) }
      for (let i = 0; i < evidenceEntries.length; i++) { setProgress(`Uploading clearance evidence ${i + 1} of ${evidenceEntries.length}…`); await putToSignedSlot(prep.evidence[i] as Slot, evidenceEntries[i].file) }

      setProgress('Registering release for review…')
      const finRes = await fetch('/api/releases', { method: 'POST', headers, body: JSON.stringify({
        title: title.trim(), genre, description: description.trim(), releaseType, rightsConfirmed: true, explicit, explicitDeclared: true,
        copyrightYear: Number(copyrightYear), masterOwnerName: masterOwner.trim(), compositionOwnerNames: compositionOwners.split(',').map((v) => v.trim()).filter(Boolean), territories: ['WORLD'],
        songwriters: songwriters.split(',').map((v) => v.trim()).filter(Boolean), producers: producers.split(',').map((v) => v.trim()).filter(Boolean), featuredArtists: featuredArtists.split(',').map((v) => v.trim()).filter(Boolean),
        materialTypes,
        evidence: evidenceEntries.map(({ materialType, file }, index) => ({ materialType, path: prep.evidence[index].path, originalFileName: file.name, mimeType: file.type, size: file.size, artistNotes: materialType === 'leased_beat' && autoLicensedBeat ? `BVS_SONG_WORKSPACE:${songWorkspaceId}` : evidenceNotes[materialType] || '' })),
        coverPath: prep.cover?.path || null,
        tracks: files.map((_, i) => ({ title: (trackTitles[i] || `Track ${i + 1}`).trim(), audioPath: prep.tracks[i].path, position: i + 1 })),
      }) })
      const fin = await finRes.json()
      if (!finRes.ok) throw new Error(fin.error || 'Submit failed')

      trackEvent('upload_complete', { genre, track_count: files.length, release_type: releaseType, song_workspace: Boolean(autoLicensedBeat) })
      setProgress(''); setTitle(''); setGenre(''); setDescription(''); setFiles([]); setTrackTitles([]); setCover(null); setRights(false); setExplicitDeclared(false); setMasterOwner(''); setCompositionOwners(''); setSongwriters(''); setProducers(''); setFeaturedArtists(''); setMaterialTypes(autoLicensedBeat ? ['leased_beat'] : ['original']); setEvidenceFiles({}); setEvidenceNotes({}); onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally { setLoading(false); setProgress('') }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {workspaceContext ? <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[.08] px-4 py-4 text-sm"><p className="font-semibold text-emerald-200">BVS beat licence attached</p><p className="mt-1 text-text-secondary">{workspaceContext.beatTitle} · {workspaceContext.producerName}. You do not need to upload the BVS licence again; Rights Passport will verify it from your purchase record.</p></div> : <p className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-text-secondary">Submit an <strong className="text-text-primary">album, EP or multi-track project</strong> (cover + ordered songs). After editorial approve &amp; publish, tracks can enter continuous rotation. Premium is separate — for multi-platform distribution when a partner is configured.</p>}

      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Release title *<input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand" placeholder="Album / EP title" /></label><label className="block text-sm">Type<select value={releaseType} onChange={(e) => setReleaseType(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"><option value="single">Single</option><option value="ep">EP</option><option value="album">Album</option><option value="mixtape">Mixtape</option><option value="compilation">Compilation</option></select></label></div>
      <label className="block text-sm">Genre *<select value={genre} onChange={(e) => setGenre(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"><option value="">Select genre</option>{genres.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
      <label className="block text-sm">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand" placeholder="Story, features, language, city…" /></label>

      <section className="space-y-4 rounded-2xl border border-brand/20 bg-brand/[.03] p-5">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-brand">Rights Passport</p><h3 className="mt-1 text-lg font-semibold">Ownership and contributor details</h3><p className="mt-1 text-xs text-text-secondary">Use legal or professionally credited names. Separate multiple names with commas.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Copyright year *<input value={copyrightYear} onChange={(e) => setCopyrightYear(e.target.value)} inputMode="numeric" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" /></label><label className="text-sm">Master recording owner *<input value={masterOwner} onChange={(e) => setMasterOwner(e.target.value)} placeholder="Person or company" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" /></label></div>
        <label className="block text-sm">Composition / publishing owner(s) *<input value={compositionOwners} onChange={(e) => setCompositionOwners(e.target.value)} placeholder="Names, separated by commas" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" /></label>
        <label className="block text-sm">Songwriter(s) / composer(s) *<input value={songwriters} onChange={(e) => setSongwriters(e.target.value)} placeholder="Names, separated by commas" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" /></label>
        <label className="block text-sm">Producer(s) *<input value={producers} onChange={(e) => setProducers(e.target.value)} placeholder="Names, separated by commas" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" /></label>
        <label className="block text-sm">Featured artist(s)<input value={featuredArtists} onChange={(e) => setFeaturedArtists(e.target.value)} placeholder="Optional; names separated by commas" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" /></label>
        <p className="text-xs text-text-secondary">Territory: worldwide for BVS review. Editorial must request changes before any narrower territory is published.</p>
      </section>

      <section className="space-y-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.03] p-5">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Material and clearance evidence</p><h3 className="mt-1 text-lg font-semibold">Tell us what this release contains</h3><p className="mt-1 text-xs text-text-secondary">Select every applicable type. BVS-purchased beat licences are verified automatically; other third-party material still needs documentary evidence.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">{materialOptions.map(([value, label]) => <label key={value} className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="checkbox" checked={materialTypes.includes(value)} disabled={value === 'leased_beat' && autoLicensedBeat} onChange={(event) => setMaterialTypes(event.target.checked ? [...new Set([...materialTypes, value])] : materialTypes.filter((item) => item !== value))} className="accent-brand" />{label}</label>)}</div>
        {autoLicensedBeat ? <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[.06] p-4 text-sm"><p className="font-medium text-emerald-200">Leased beat evidence: verified by BVS</p><p className="mt-1 text-text-secondary">{workspaceContext?.licenceSummary}</p></div> : null}
        {materialTypes.filter((type) => type !== 'original' && !(type === 'leased_beat' && autoLicensedBeat)).map((type) => { const label = materialOptions.find(([value]) => value === type)?.[1] || type; return <div key={type} className="rounded-xl border border-amber-200/20 p-4"><label className="block text-sm font-medium">{label} clearance document *</label><input type="file" accept="application/pdf,image/*" onChange={(event) => setEvidenceFiles({ ...evidenceFiles, [type]: event.target.files?.[0] || null })} className="mt-2 text-sm" /><textarea value={evidenceNotes[type] || ''} onChange={(event) => setEvidenceNotes({ ...evidenceNotes, [type]: event.target.value })} placeholder="Who granted permission, scope, territories, dates or licence reference" className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 text-sm" /><p className="mt-2 text-xs text-text-secondary">PDF or image, maximum 10MB. Evidence remains private to the artist and authorized editorial staff.</p></div> })}
      </section>

      <div><label className="mb-1.5 block text-sm font-medium">Audio tracks * (1–30)</label><input type="file" multiple onChange={(e) => onFiles(e.target.files)} className="text-sm" />{files.length > 0 && <ul className="mt-3 space-y-2">{files.map((f, i) => <li key={`${f.name}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"><span className="text-xs text-brand">{i + 1}</span><input value={trackTitles[i] || ''} onChange={(e) => { const next = [...trackTitles]; next[i] = e.target.value; setTrackTitles(next) }} className="min-w-[12rem] flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1" /><span className="text-xs text-text-secondary">{(f.size / (1024 * 1024)).toFixed(1)} MB</span></li>)}</ul>}</div>
      <div><label className="mb-1.5 block text-sm font-medium">Cover art *</label><input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} className="text-sm" />{cover && <p className="mt-1 text-xs text-text-secondary">{cover.name}</p>}</div>
      <label className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 accent-brand" /><span><strong className="block">I control the necessary rights</strong><span className="text-text-secondary">I have permission for every recording and composition on this release for BVS streaming and, if I join Premium later, multi-platform distribution packaging.</span></span></label>
      <label className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm"><input type="checkbox" checked={explicitDeclared} onChange={(e) => setExplicitDeclared(e.target.checked)} className="mt-1 accent-brand" /><span><strong className="block">Explicit status declared *</strong><span className="text-text-secondary">I reviewed every track and the explicit-content choice below is accurate.</span></span></label>
      <label className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm"><input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} className="mt-1 accent-brand" /><span><strong className="block">Explicit content</strong><span className="text-text-secondary">Mark if any track contains explicit language or themes.</span></span></label>
      {error && <div role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {loading && progress && <p className="text-center text-sm text-brand" aria-live="polite">{progress}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-full bg-brand py-4 text-lg font-semibold text-black hover:bg-brand-dark disabled:opacity-60">{loading ? progress || 'Submitting…' : 'Submit release for review'}</button>
    </form>
  )
}
