'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { roleLabels, type EditorialPermission, type EditorialRole } from '@/lib/editorial'

type Track = { id: string; user_id: string; title: string; artist_name: string; genre: string; file_url: string; editorial_status: string; editorial_notes?: string; is_public: boolean; in_rotation: boolean; is_downloadable: boolean; download_price: number; licence_type: string; licence_summary?: string; created_at: string }
type Profile = { id: string; username: string; display_name?: string; role: string; is_verified: boolean; is_published: boolean }
type Programme = { id: string; slug: string; title: string; host: string; day_label: string; start_time?: string; timezone: string; status: string }
type Credit = { id: string; track_id: string; person_name: string; credit_role: string }
type Staff = { user_id: string; role: EditorialRole; active: boolean }
type Audit = { id: number; action: string; entity_type: string; entity_id: string; created_at: string }
type EditorialData = { identity: { role: EditorialRole; permissions: EditorialPermission[]; profile?: Profile }; tracks: Track[]; profiles: Profile[]; programmes: Programme[]; credits: Credit[]; staff: Staff[]; auditLog: Audit[] }

const statusClass: Record<string, string> = { submitted: 'text-amber-300', in_review: 'text-blue-300', approved: 'text-emerald-300', rejected: 'text-red-300' }

export default function EditorialDashboard() {
  const [data, setData] = useState<EditorialData | null>(null)
  const [token, setToken] = useState('')
  const configured = isSupabaseConfigured()
  const [error, setError] = useState(configured ? '' : 'Supabase is not configured.')
  const [busy, setBusy] = useState('')

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch('/api/admin/editorial', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Could not load editorial dashboard.')
    setData(payload)
  }, [])

  useEffect(() => {
    if (!configured) return
    createClient().auth.getSession().then(({ data: sessionData }) => {
      const accessToken = sessionData.session?.access_token
      if (!accessToken) { setError('Sign in with an editorial staff account.'); return }
      setToken(accessToken)
      load(accessToken).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Editorial access failed.'))
    })
  }, [configured, load])

  const allowed = (permission: EditorialPermission) => Boolean(data?.identity.permissions.includes(permission))
  const act = async (action: string, body: Record<string, unknown>) => {
    setBusy(`${action}-${String(body.trackId || body.profileId || body.slug || body.userId || '')}`)
    setError('')
    try {
      const response = await fetch('/api/admin/editorial', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...body }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Editorial action failed.')
      await load(token)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Editorial action failed.') }
    finally { setBusy('') }
  }

  if (error && !data) return <main className="mx-auto min-h-[65vh] max-w-2xl px-6 py-20 text-center"><h1 className="text-3xl">Editorial access unavailable</h1><p className="mt-4 text-text-secondary">{error}</p><Link href="/auth/login" className="mt-7 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link></main>
  if (!data) return <main className="p-20 text-center text-text-secondary">Loading editorial workflow…</main>

  return <main className="mx-auto max-w-7xl px-6 py-12">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs uppercase tracking-[.22em] text-brand">BVS operations</p><h1 className="mt-2 text-4xl font-semibold">Editorial workflow</h1><p className="mt-3 text-text-secondary">Signed in as {roleLabels[data.identity.role]}. Every action is recorded.</p></div><button onClick={() => load(token)} className="rounded-full border border-white/20 px-5 py-2 text-sm">Refresh</button></div>
    {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}

    <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[['Awaiting review', data.tracks.filter(t => ['submitted','in_review'].includes(t.editorial_status)).length], ['Approved', data.tracks.filter(t => t.editorial_status === 'approved').length], ['Published', data.tracks.filter(t => t.is_public).length], ['In rotation', data.tracks.filter(t => t.in_rotation).length], ['Scheduled shows', data.programmes.filter(p => ['scheduled','active'].includes(p.status)).length]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><p className="text-sm text-text-secondary">{label}</p><p className="mt-2 text-3xl font-semibold text-brand">{value}</p></div>)}
    </section>

    <section className="mt-12"><h2 className="text-2xl font-semibold">Submission queue</h2><p className="mt-2 text-sm text-text-secondary">Approval does not automatically publish or add a track to rotation.</p><div className="mt-5 space-y-4">{data.tracks.map(track => <TrackCard key={track.id} track={track} credits={data.credits.filter(c => c.track_id === track.id)} allowed={allowed} act={act} busy={busy} />)}{data.tracks.length === 0 && <Empty text="No submissions yet." />}</div></section>

    <section className="mt-14 grid gap-10 lg:grid-cols-2">
      <div><h2 className="text-2xl font-semibold">Artist publishing</h2><div className="mt-5 space-y-3">{data.profiles.filter(profile => ['artist','admin'].includes(profile.role)).map(profile => <div key={profile.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4"><div><p className="font-medium">{profile.display_name || profile.username}</p><p className="text-xs text-text-secondary">@{profile.username} · {profile.is_published ? 'Published and verified' : 'Not published'}</p></div>{allowed('publish_artists') && <button disabled={Boolean(busy)} onClick={() => act('publish_artist', { profileId: profile.id, publish: !profile.is_published })} className="rounded-full border border-white/20 px-4 py-2 text-xs hover:border-brand">{profile.is_published ? 'Unpublish' : 'Publish'}</button>}</div>)}</div></div>
      <ProgrammePanel programmes={data.programmes} enabled={allowed('schedule_programmes')} act={act} />
    </section>

    {allowed('manage_staff') && <StaffPanel profiles={data.profiles} staff={data.staff} act={act} />}
    <section className="mt-14"><h2 className="text-2xl font-semibold">Recent audit trail</h2><div className="mt-4 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-white/5 text-text-secondary"><tr><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">ID</th></tr></thead><tbody>{data.auditLog.map(entry => <tr key={entry.id} className="border-t border-white/10"><td className="p-3 text-text-secondary">{new Date(entry.created_at).toLocaleString()}</td><td className="p-3">{entry.action.replaceAll('_', ' ')}</td><td className="p-3">{entry.entity_type}</td><td className="max-w-64 truncate p-3 font-mono text-xs">{entry.entity_id}</td></tr>)}</tbody></table></div></section>
  </main>
}

function TrackCard({ track, credits, allowed, act, busy }: { track: Track; credits: Credit[]; allowed: (p: EditorialPermission) => boolean; act: (action: string, body: Record<string, unknown>) => Promise<void>; busy: string }) {
  const [notes, setNotes] = useState(track.editorial_notes || '')
  const [price, setPrice] = useState(String(track.download_price || 0))
  const [licenceType, setLicenceType] = useState(track.licence_type || 'not_for_sale')
  const [licenceSummary, setLicenceSummary] = useState(track.licence_summary || '')
  const [personName, setPersonName] = useState('')
  const [creditRole, setCreditRole] = useState('')
  const disabled = Boolean(busy)
  return <article className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="flex flex-wrap justify-between gap-4"><div><p className={`text-xs font-semibold uppercase tracking-wider ${statusClass[track.editorial_status] || 'text-text-secondary'}`}>{track.editorial_status.replace('_', ' ')}</p><h3 className="mt-1 text-xl font-semibold">{track.title}</h3><p className="text-sm text-text-secondary">{track.artist_name} · {track.genre} · {new Date(track.created_at).toLocaleDateString()}</p></div><audio controls preload="none" src={track.file_url} className="h-10 max-w-full" /></div>
    {allowed('approve_submissions') && <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Private review notes" className="min-h-20 rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-brand"/><div className="flex flex-wrap items-start gap-2"><button disabled={disabled} onClick={() => act('review_track', { trackId: track.id, status: 'approved', notes })} className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black">Approve</button><button disabled={disabled} onClick={() => act('review_track', { trackId: track.id, status: 'rejected', notes })} className="rounded-full bg-red-400 px-4 py-2 text-xs font-semibold text-black">Reject</button>{track.editorial_status === 'approved' && <button disabled={disabled} onClick={() => act('publish_track', { trackId: track.id, publish: !track.is_public })} className="rounded-full border border-brand px-4 py-2 text-xs text-brand">{track.is_public ? 'Unpublish track' : 'Publish track'}</button>}</div></div>}
    <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-3">
      <div><h4 className="text-sm font-semibold">Rotation</h4><p className="mt-1 text-xs text-text-secondary">{track.in_rotation ? 'Included in the station player' : 'Not in rotation'}</p>{allowed('manage_rotation') && <button disabled={disabled} onClick={() => act('set_rotation', { trackId: track.id, enabled: !track.in_rotation })} className="mt-3 rounded-full border border-white/20 px-4 py-2 text-xs">{track.in_rotation ? 'Remove' : 'Add to rotation'}</button>}</div>
      <div><h4 className="text-sm font-semibold">Licensing &amp; price</h4>{allowed('manage_licensing') ? <div className="mt-2 space-y-2"><select value={licenceType} onChange={e => setLicenceType(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bg-primary p-2 text-xs"><option value="not_for_sale">Not for sale</option><option value="personal_download">Personal download</option><option value="standard_lease">Standard lease</option><option value="exclusive">Exclusive</option><option value="custom">Custom</option></select><input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" placeholder="USD price"/><input value={licenceSummary} onChange={e => setLicenceSummary(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" placeholder="Rights summary"/><button disabled={disabled} onClick={() => act('manage_license', { trackId: track.id, licenceType, price, summary: licenceSummary })} className="rounded-full border border-brand px-4 py-2 text-xs text-brand">Save terms</button></div> : <p className="mt-1 text-xs text-text-secondary">{track.licence_type} · ${track.download_price}</p>}</div>
      <div><h4 className="text-sm font-semibold">Verified credits</h4><ul className="mt-2 space-y-1 text-xs text-text-secondary">{credits.map(c => <li key={c.id}>{c.person_name} — {c.credit_role}</li>)}</ul>{allowed('verify_credits') && <div className="mt-2 space-y-2"><input value={personName} onChange={e => setPersonName(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" placeholder="Person / artist"/><input value={creditRole} onChange={e => setCreditRole(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" placeholder="Producer, writer, engineer…"/><button disabled={disabled || !personName || !creditRole} onClick={() => act('add_credit', { trackId: track.id, personName, creditRole })} className="rounded-full border border-brand px-4 py-2 text-xs text-brand">Verify credit</button></div>}</div>
    </div>
  </article>
}

function ProgrammePanel({ programmes, enabled, act }: { programmes: Programme[]; enabled: boolean; act: (action: string, body: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ title: '', slug: '', host: 'BVS Radio', dayLabel: '', startTime: '', timezone: 'Africa/Harare', status: 'draft', tagline: '', description: '', imageUrl: '' })
  const submit = (event: FormEvent) => { event.preventDefault(); void act('save_programme', form) }
  return <div><h2 className="text-2xl font-semibold">Programme schedule</h2><div className="mt-5 space-y-2">{programmes.map(p => <div key={p.id} className="rounded-xl border border-white/10 p-4"><p className="font-medium">{p.title}</p><p className="text-xs text-text-secondary">{p.day_label} {p.start_time?.slice(0,5)} · {p.timezone} · {p.status}</p></div>)}</div>{enabled && <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-5 sm:grid-cols-2"><input required value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Programme title" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><input value={form.slug} onChange={e => setForm({...form,slug:e.target.value})} placeholder="Slug (automatic if blank)" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><input required value={form.dayLabel} onChange={e => setForm({...form,dayLabel:e.target.value})} placeholder="Friday / Daily" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><input type="time" value={form.startTime} onChange={e => setForm({...form,startTime:e.target.value})} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><input value={form.host} onChange={e => setForm({...form,host:e.target.value})} placeholder="Host" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><select value={form.status} onChange={e => setForm({...form,status:e.target.value})} className="rounded-xl border border-white/10 bg-bg-primary p-3 text-sm"><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="archived">Archived</option></select><textarea value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Programme description" className="sm:col-span-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><button className="rounded-full bg-brand px-5 py-3 font-semibold text-black sm:col-span-2">Save programme</button></form>}</div>
}

function StaffPanel({ profiles, staff, act }: { profiles: Profile[]; staff: Staff[]; act: (action: string, body: Record<string, unknown>) => Promise<void> }) {
  const [userId, setUserId] = useState(''); const [role, setRole] = useState<EditorialRole>('editor')
  return <section className="mt-14"><h2 className="text-2xl font-semibold">Staff roles</h2><p className="mt-2 text-sm text-text-secondary">Only administrators can assign these permissions.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{staff.map(member => { const p=profiles.find(profile=>profile.id===member.user_id); return <div key={member.user_id} className="rounded-xl border border-white/10 p-4"><p className="font-medium">{p?.display_name || p?.username || member.user_id}</p><p className="text-xs text-text-secondary">{roleLabels[member.role]} · {member.active ? 'active' : 'disabled'}</p></div>})}</div><div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-white/10 p-4"><select value={userId} onChange={e=>setUserId(e.target.value)} className="min-w-56 rounded-lg border border-white/10 bg-bg-primary p-2 text-sm"><option value="">Select account</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name || p.username}</option>)}</select><select value={role} onChange={e=>setRole(e.target.value as EditorialRole)} className="rounded-lg border border-white/10 bg-bg-primary p-2 text-sm">{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button disabled={!userId} onClick={()=>act('assign_staff',{userId,role,active:true})} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Assign role</button></div></section>
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-text-secondary">{text}</div> }
