'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type Profile = {
  username: string
  display_name?: string
  avatar_url?: string
  display_avatar_url?: string
  bio?: string
  role: string
  is_producer?: boolean
  is_verified?: boolean
  is_published?: boolean
  creator_public_name?: string
  creator_name_request?: string
  creator_name_status?: 'not_submitted' | 'pending' | 'approved' | 'changes_requested' | 'rejected'
  creator_name_review_notes?: string
  created_at?: string
}
type Order = {
  reference: string
  status: string
  delivery_status: string
  total: number | string
  payment_method: string
  items?: Array<{ title?: string; quantity?: number }>
  created_at: string
}
type Access = { creator?: boolean; artist?: boolean; producer?: boolean; writer?: boolean; showCreator?: boolean; editorial?: boolean; admin?: boolean }
type RoleApplication = {
  id: string
  requested_role: 'artist' | 'producer' | 'writer' | 'show_creator'
  status: 'submitted' | 'information_requested' | 'approved' | 'rejected'
  message?: string
  review_notes?: string
  updated_at: string
}
type AccountData = {
  user: { email: string; fullName?: string; createdAt?: string | null }
  profile: Profile | null
  orders: Order[]
}

const field = 'mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand'

export default function AccountPage() {
  const [token, setToken] = useState('')
  const [data, setData] = useState<AccountData | null>(null)
  const [access, setAccess] = useState<Access>({})
  const [roleApplication, setRoleApplication] = useState<RoleApplication | null>(null)
  const [roleForm, setRoleForm] = useState({ requestedRole: 'artist', message: '' })
  const [applying, setApplying] = useState(false)
  const [form, setForm] = useState({ username: '', fullName: '', displayName: '', creatorPublicName: '', avatarUrl: '', bio: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [showDeletion, setShowDeletion] = useState(false)
  const [deletionConfirmation, setDeletionConfirmation] = useState('')
  const [deletionReason, setDeletionReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = async (accessToken: string) => {
    const headers = { Authorization: `Bearer ${accessToken}` }
    const [accountResponse, accessResponse, applicationResponse] = await Promise.all([
      fetch('/api/account', { headers, cache: 'no-store' }),
      fetch('/api/auth/access', { headers, cache: 'no-store' }),
      fetch('/api/account/role-application', { headers, cache: 'no-store' }),
    ])
    const account = await accountResponse.json()
    if (!accountResponse.ok) throw new Error(account.error || 'Could not load Account Centre.')
    const accessPayload = accessResponse.ok ? await accessResponse.json() : {}
    const applicationPayload = applicationResponse.ok ? await applicationResponse.json() : {}
    setData(account)
    setAccess(accessPayload.access || {})
    setRoleApplication(applicationPayload.application || null)
    setForm({
      username: account.profile?.username || '',
      fullName: account.user?.fullName || '',
      displayName: account.profile?.display_name || '',
      creatorPublicName: account.profile?.creator_name_request || account.profile?.creator_public_name || '',
      avatarUrl: account.profile?.avatar_url || '',
      bio: account.profile?.bio || '',
    })
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Account service is unavailable.')
      setLoading(false)
      return
    }
    createClient().auth.getSession().then(async ({ data: sessionData }) => {
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setLoading(false)
        return
      }
      setToken(accessToken)
      try {
        await load(accessToken)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load Account Centre.')
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const shortcuts = useMemo(() => {
    const items = [
      { href: '/library', title: 'Library', copy: 'Favourites, follows and listening history.' },
      { href: '/checkout', title: 'Cart', copy: 'Review your current basket and continue checkout.' },
    ]
    if (access.creator) items.push({ href: '/creator/studio', title: 'Creator Studio', copy: 'Manage submissions, releases and creator workflows.' })
    if (access.artist) items.push({ href: '/artists', title: 'Artist wallet', copy: 'View onboarding, deposits, balance and payout readiness.' })
    if (access.editorial) items.push({ href: '/admin/editorial', title: 'Editorial', copy: 'Open the BVS editorial workspace.' })
    return items
  }, [access])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      let avatarUrl = form.avatarUrl
      if (avatarFile) {
        const preparedResponse = await fetch('/api/account/avatar/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: avatarFile.name, type: avatarFile.type, size: avatarFile.size }),
        })
        const prepared = await preparedResponse.json()
        if (!preparedResponse.ok) throw new Error(prepared.error || 'Could not prepare profile-picture upload.')
        const { error: uploadError } = await createClient().storage.from(prepared.bucket).uploadToSignedUrl(prepared.slot.path, prepared.slot.token, avatarFile, { contentType: avatarFile.type || 'image/jpeg', upsert: true })
        if (uploadError) throw new Error('Could not upload your profile picture.')
        avatarUrl = prepared.publicUrl
      }
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, avatarUrl }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not update your profile.')
      await load(token)
      setAvatarFile(null)
      setAvatarPreview('')
      setMessage('Profile updated.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update your profile.')
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    await createClient().auth.signOut()
    window.location.href = '/'
  }

  const applyForRole = async (event: FormEvent) => {
    event.preventDefault()
    setApplying(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/account/role-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(roleForm),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not submit your role application.')
      setRoleApplication(payload.application)
      setMessage('Your role application was sent to editorial.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit your role application.')
    } finally {
      setApplying(false)
    }
  }

  const requestDeletion = async () => {
    setDeleting(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/account/deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmation: deletionConfirmation, reason: deletionReason }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not request account deletion.')
      setMessage(`${payload.message} Reference: ${payload.reference}`)
      setShowDeletion(false)
      setDeletionConfirmation('')
      setDeletionReason('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not request account deletion.')
    } finally {
      setDeleting(false)
    }
  }

  const exportData = async () => {
    setError('')
    try {
      const response = await fetch('/api/account/export', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Could not export your data.')
      }
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `bvs-account-export-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(href)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not export your data.')
    }
  }
  const customAvatar = form.avatarUrl && !form.avatarUrl.includes('default-avatar') ? form.avatarUrl : ''
  const currentPhoto = avatarPreview || customAvatar || data?.profile?.display_avatar_url || '/assets/images/default-avatar.png'
  const accountRole = access.admin
    ? 'Administrator'
    : access.editorial
      ? 'Editorial'
      : access.producer && data?.profile?.role === 'listener'
        ? 'Producer'
        : data?.profile?.role === 'show_creator'
          ? 'Show creator'
          : data?.profile?.role || 'Listener'
  const creatorCapable = Boolean(access.artist || access.producer || data?.profile?.role === 'artist' || data?.profile?.is_producer)

  if (loading) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Loading Account Centre…</main>
  if (!token) return <main className="mx-auto min-h-[65vh] max-w-xl px-6 py-20 text-center"><p className="text-xs uppercase tracking-[.22em] text-brand">Account Centre</p><h1 className="mt-3 text-4xl">Sign in to continue</h1><p className="mt-4 text-text-secondary">Your profile, library, orders and role-specific tools live here.</p><Link href="/auth/login?next=/account" className="mt-7 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link></main>
  if (!data?.profile) return <main className="mx-auto min-h-[65vh] max-w-xl px-6 py-20 text-center"><h1 className="text-3xl">Profile unavailable</h1><p className="mt-4 text-text-secondary">{error || 'Your account profile could not be loaded.'}</p></main>

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[.22em] text-brand">Account Centre</p>
          <h1 className="mt-2 text-4xl font-semibold">Welcome, {data.profile.display_name || data.profile.username}</h1>
          <p className="mt-3 text-text-secondary">{data.user.email}</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full border border-brand/40 px-4 py-2 text-sm capitalize text-brand">{accountRole}</span>
          {data.profile.is_verified && <span className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">Verified</span>}
        </div>
      </div>

      {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
      {message && <p className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-brand">{message}</p>}

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border border-white/10 bg-white/[.025] p-5 transition hover:border-brand/50"><h2 className="text-lg font-semibold">{item.title}</h2><p className="mt-2 text-sm text-text-secondary">{item.copy}</p></Link>)}
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <form onSubmit={save} className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
          <h2 className="text-2xl font-semibold">Profile</h2>
          <p className="mt-2 text-sm text-text-secondary">Account, member and creator names are kept separate so a private name is never used as an artist name by accident.</p>
          <div className="mt-6 flex flex-wrap items-center gap-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border border-white/15 bg-white/5">
              <Image src={currentPhoto} alt={`${form.displayName || form.username} profile`} fill unoptimized={/^https?:\/\//i.test(currentPhoto)} className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Profile picture</p>
              <p className="mt-1 text-sm text-text-secondary">Your current public photo is shown here. Upload JPG, PNG or WebP up to 8 MB.</p>
              <label className="mt-3 inline-block cursor-pointer rounded-full border border-brand px-4 py-2 text-sm text-brand hover:bg-brand/10">
                Upload new photo
                <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setAvatarFile(file)
                  if (avatarPreview) URL.revokeObjectURL(avatarPreview)
                  setAvatarPreview(file ? URL.createObjectURL(file) : '')
                }} />
              </label>
              {avatarFile && <p className="mt-2 truncate text-xs text-text-secondary">{avatarFile.name} · saved when you press Save profile</p>}
              {(customAvatar || avatarFile) && <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(''); setForm({ ...form, avatarUrl: '/assets/images/default-avatar.png' }) }} className="ml-3 mt-3 text-sm text-text-secondary hover:text-red-300">Remove custom photo</button>}
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Full/legal name <span className="text-xs font-normal text-text-secondary">· private</span><input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} autoComplete="name" className={field} /><span className="mt-1 block text-xs font-normal text-text-secondary">Used for account administration, contracts, payouts and invoices. Never shown on creator pages.</span></label>
            <label className="text-sm font-medium">Member display name<input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className={field} /><span className="mt-1 block text-xs font-normal text-text-secondary">Shown in signed-in member areas such as community features.</span></label>
            <label className="text-sm font-medium">Username (@handle)<input required readOnly value={form.username} className={`${field} cursor-not-allowed opacity-70`} /><span className="mt-1 block text-xs font-normal text-text-secondary">Your permanent login handle and profile URL. Contact BVS if it was entered incorrectly.</span></label>
            {creatorCapable && <label className="text-sm font-medium">Artist / producer public name<input value={form.creatorPublicName} onChange={(event) => setForm({ ...form, creatorPublicName: event.target.value })} placeholder={`@${form.username}`} className={field} /><span className="mt-1 block text-xs font-normal text-text-secondary">Used on public creator pages, BeatStore and search after Editorial approval. Until then, we show @{form.username}. You may leave this blank.</span></label>}
            <label className="text-sm font-medium sm:col-span-2">Bio<textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={5} className={field} /></label>
          </div>
          {creatorCapable && data.profile.creator_name_status && data.profile.creator_name_status !== 'not_submitted' && (
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
              <p className="font-medium capitalize">Public-name review · {data.profile.creator_name_status.replaceAll('_', ' ')}</p>
              {data.profile.creator_public_name && <p className="mt-1 text-text-secondary">Currently public: {data.profile.creator_public_name}</p>}
              {data.profile.creator_name_review_notes && <p className="mt-2 text-text-secondary">Editorial: {data.profile.creator_name_review_notes}</p>}
            </div>
          )}
          <button disabled={saving} className="mt-6 rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
        </form>

        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
            <h2 className="text-2xl font-semibold">Creator role</h2>
            <p className="mt-2 text-sm text-text-secondary">Apply for creator access. Editorial reviews every request before account permissions change.</p>
            {roleApplication && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                <p className="font-medium capitalize">{roleApplication.requested_role.replaceAll('_', ' ')} · {roleApplication.status.replaceAll('_', ' ')}</p>
                {roleApplication.review_notes && <p className="mt-2 text-text-secondary">Editorial: {roleApplication.review_notes}</p>}
              </div>
            )}
            {(!roleApplication || ['information_requested', 'rejected'].includes(roleApplication.status)) && (
              <form onSubmit={applyForRole} className="mt-4 space-y-3">
                <select value={roleForm.requestedRole} onChange={(event) => setRoleForm({ ...roleForm, requestedRole: event.target.value })} className={field}>
                  <option value="artist">Artist</option>
                  <option value="producer">Producer</option>
                  <option value="writer">Writer</option>
                  <option value="show_creator">Show creator</option>
                </select>
                <textarea required minLength={20} value={roleForm.message} onChange={(event) => setRoleForm({ ...roleForm, message: event.target.value })} rows={4} placeholder="Tell editorial about your work and include useful profile, catalogue or portfolio links." className={field} />
                <button disabled={applying} className="rounded-full border border-brand px-5 py-2 text-sm text-brand disabled:opacity-50">{applying ? 'Submitting…' : roleApplication ? 'Send updated information' : 'Apply for role'}</button>
              </form>
            )}
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
            <h2 className="text-2xl font-semibold">Security</h2>
            <p className="mt-2 text-sm text-text-secondary">Password changes are confirmed through your account email.</p>
            <Link href="/auth/forgot-password" className="mt-5 inline-block rounded-full border border-white/20 px-5 py-2 text-sm hover:border-brand">Reset password</Link>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
            <h2 className="text-2xl font-semibold">Privacy and account</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/privacy" className="rounded-full border border-white/20 px-5 py-2 text-sm hover:border-brand">Privacy policy</Link>
              <Link href="/refunds" className="rounded-full border border-white/20 px-5 py-2 text-sm hover:border-brand">Refund policy</Link>
              <button type="button" onClick={() => void exportData()} className="rounded-full border border-white/20 px-5 py-2 text-sm hover:border-brand">Download my data</button>
              <button type="button" onClick={() => setShowDeletion(true)} className="rounded-full border border-white/20 px-5 py-2 text-sm hover:border-red-300">Delete account</button>
              <button type="button" onClick={signOut} className="rounded-full border border-white/20 px-5 py-2 text-sm hover:border-brand">Sign out</button>
            </div>
          </section>
          {showDeletion && <section className="rounded-2xl border border-red-400/30 bg-red-500/[.06] p-6">
            <h2 className="text-2xl font-semibold">Request account deletion</h2>
            <p className="mt-2 text-sm text-text-secondary">This starts an authenticated deletion request. Published creator content and active purchases are reviewed before removal so other people’s purchases and credits are not broken.</p>
            <label className="mt-4 block text-sm font-medium">Reason (optional)<textarea value={deletionReason} onChange={(event) => setDeletionReason(event.target.value)} rows={3} className={field} /></label>
            <label className="mt-4 block text-sm font-medium">Type DELETE to confirm<input value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} className={field} /></label>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" disabled={deleting || deletionConfirmation.trim().toUpperCase() !== 'DELETE'} onClick={() => void requestDeletion()} className="rounded-full bg-red-400 px-5 py-2 text-sm font-semibold text-black disabled:opacity-50">{deleting ? 'Submitting…' : 'Submit deletion request'}</button>
              <button type="button" onClick={() => setShowDeletion(false)} className="rounded-full border border-white/20 px-5 py-2 text-sm">Cancel</button>
            </div>
          </section>}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-white/10 bg-white/[.025] p-6">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">Orders and purchases</h2><p className="mt-2 text-sm text-text-secondary">Orders placed while signed in appear here.</p></div><Link href="/shop" className="text-sm text-brand">Browse services →</Link></div>
        {data.orders.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase text-text-secondary"><tr><th className="pb-3">Order</th><th className="pb-3">Items</th><th className="pb-3">Status</th><th className="pb-3">Delivery</th><th className="pb-3">Total</th><th className="pb-3">Date</th><th className="pb-3">Receipt</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.reference} className="border-t border-white/10"><td className="py-4 pr-4 font-medium text-brand">{order.reference}</td><td className="py-4 pr-4 text-text-secondary">{order.items?.map((item) => item.title).filter(Boolean).join(', ') || 'BVS order'}</td><td className="py-4 pr-4 capitalize text-text-secondary">{order.status.replaceAll('_', ' ')}</td><td className="py-4 pr-4 capitalize text-text-secondary">{order.delivery_status?.replaceAll('_', ' ') || 'pending'}</td><td className="py-4 pr-4">${Number(order.total || 0).toFixed(2)}</td><td className="py-4 pr-4 text-text-secondary">{new Date(order.created_at).toLocaleDateString()}</td><td className="py-4"><Link href={`/account/orders/${encodeURIComponent(order.reference)}`} className="text-brand hover:underline">View →</Link></td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">No signed-in orders yet.</p>}
      </section>
    </main>
  )
}
