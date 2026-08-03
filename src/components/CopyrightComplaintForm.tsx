'use client'

import { useState } from 'react'

export default function CopyrightComplaintForm() {
  const [claimantName, setClaimantName] = useState('')
  const [claimantEmail, setClaimantEmail] = useState('')
  const [claimantOrganization, setClaimantOrganization] = useState('')
  const [workTitle, setWorkTitle] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [originalUrls, setOriginalUrls] = useState('')
  const [infringingUrls, setInfringingUrls] = useState('')
  const [statement, setStatement] = useState('')
  const [signatureName, setSignatureName] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [accuracy, setAccuracy] = useState(false)
  const [authority, setAuthority] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docket, setDocket] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDocket(null)
    setLoading(true)
    try {
      const res = await fetch('/api/copyright/complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimantName,
          claimantEmail,
          claimantOrganization: claimantOrganization || undefined,
          workTitle,
          workDescription,
          originalWorkUrls: originalUrls,
          allegedlyInfringingUrls: infringingUrls,
          statement,
          signatureName,
          goodFaithDeclaration: goodFaith,
          accuracyDeclaration: accuracy,
          authorityDeclaration: authority,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not submit complaint.')
      setDocket(data.docketNumber || null)
      setStatement('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit complaint.')
    } finally {
      setLoading(false)
    }
  }

  if (docket) {
    return (
      <div className="rounded-xl border border-brand/30 bg-brand/10 p-5 text-sm text-text-primary" role="status">
        <p className="font-semibold">Complaint received</p>
        <p className="mt-2 text-text-secondary">
          Docket number: <code className="text-brand">{docket}</code>. Keep this reference. Staff will review.
          BVS does not auto-delete content or accounts from this form.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-white/10 bg-black/20 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Full name *
          <input required value={claimantName} onChange={(e) => setClaimantName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2" />
        </label>
        <label className="block text-sm">
          Email *
          <input required type="email" value={claimantEmail} onChange={(e) => setClaimantEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm">
        Organisation (optional)
        <input value={claimantOrganization} onChange={(e) => setClaimantOrganization(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2" />
      </label>
      <label className="block text-sm">
        Copyrighted work title *
        <input required value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2" />
      </label>
      <label className="block text-sm">
        Work description
        <textarea value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2" />
      </label>
      <label className="block text-sm">
        Original work URL(s) (optional, one per line)
        <textarea value={originalUrls} onChange={(e) => setOriginalUrls(e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2" placeholder="https://..." />
      </label>
      <label className="block text-sm">
        BVS location URL(s) of alleged material *
        <textarea required value={infringingUrls} onChange={(e) => setInfringingUrls(e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2" placeholder="https://bvsradio.com/..." />
      </label>
      <label className="block text-sm">
        Statement *
        <textarea required value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2" placeholder="Describe the issue and the rights you claim..." />
      </label>
      <label className="block text-sm">
        Electronic signature (full name) *
        <input required value={signatureName} onChange={(e) => setSignatureName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2" />
      </label>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} className="mt-1 accent-brand" />
        <span>Good-faith declaration: I believe the use of the material is not authorised by the rights holder, its agent, or the law.</span>
      </label>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" checked={accuracy} onChange={(e) => setAccuracy(e.target.checked)} className="mt-1 accent-brand" />
        <span>Accuracy declaration: the information in this complaint is accurate to the best of my knowledge.</span>
      </label>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" checked={authority} onChange={(e) => setAuthority(e.target.checked)} className="mt-1 accent-brand" />
        <span>Authority declaration: I am the rights holder or authorised to act on the rights holder&apos;s behalf.</span>
      </label>
      {error && <div role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      <button type="submit" disabled={loading} className="rounded-full bg-brand px-6 py-3 font-semibold text-black hover:bg-brand-dark disabled:opacity-60">
        {loading ? 'Submitting…' : 'Submit copyright complaint'}
      </button>
    </form>
  )
}
