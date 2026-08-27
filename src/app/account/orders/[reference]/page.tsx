'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type Item = {
  id?: string
  sourceId?: string
  title?: string
  quantity?: number
  price?: number
  type?: string
  productType?: string
  artist?: string
  licenceCode?: string
  licenceSummary?: string
}
type Receipt = {
  reference: string
  status: string
  delivery_status?: string
  subtotal?: number
  tax_amount?: number
  tax_rate?: number
  tax_label?: string
  tax_country?: string
  total: number
  currency?: string
  payment_method?: string
  items: Item[]
  created_at: string
  downloads: Array<{ itemId: string; title: string; href: string }>
  licenceSummary: Array<{ title: string; licence: string }>
}

function money(value: number | undefined, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0))
}

function statusClass(status: string) {
  const s = status.toLowerCase()
  if (s === 'paid' || s === 'fulfilled') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
  if (s.includes('pending')) return 'border-amber-400/30 bg-amber-500/15 text-amber-100'
  if (s.includes('cancel')) return 'border-red-400/30 bg-red-500/15 text-red-200'
  return 'border-brand/30 bg-brand/10 text-brand'
}

export default function OrderReceiptPage() {
  const params = useParams<{ reference: string }>()
  const [token, setToken] = useState('')
  const [order, setOrder] = useState<Receipt | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [openingBeat, setOpeningBeat] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Account service unavailable.')
      setLoading(false)
      return
    }
    createClient().auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token
      if (!accessToken) {
        setError('Sign in to view this receipt.')
        setLoading(false)
        return
      }
      setToken(accessToken)
      const response = await fetch(`/api/account/orders/${encodeURIComponent(params.reference)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) setError(payload.error || 'Could not load receipt.')
      else setOrder(payload.order)
      setLoading(false)
    })
  }, [params.reference])

  async function openLyricsPad(item: Item) {
    const beatId = String(item.sourceId || item.id || '')
    if (!token || !beatId) return
    setOpeningBeat(beatId)
    setError('')
    try {
      const response = await fetch('/api/creator/song-workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderReference: params.reference, beatId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not open Lyrics Pad.')
      window.location.href = `/creator/studio/songs/${payload.workspace.id}`
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open Lyrics Pad.')
      setOpeningBeat('')
    }
  }

  if (loading) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Loading receipt…</main>
  if (!order) return (
    <main className="mx-auto min-h-[65vh] max-w-xl px-6 py-20 text-center"><h1 className="text-3xl font-semibold">Receipt unavailable</h1><p className="mt-4 text-text-secondary">{error}</p><Link href="/account" className="mt-6 inline-block text-brand">← Account Centre</Link></main>
  )

  const currency = order.currency || 'USD'
  const paid = ['paid', 'fulfilled'].includes(order.status)
  const beatItems = paid ? order.items.filter((item) => item.type === 'beat' || item.productType === 'beat') : []

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="print:hidden"><Link href="/account" className="text-sm text-brand">← Account Centre</Link></div>

      {beatItems.length > 0 && (
        <section className="mt-6 rounded-3xl border border-brand/25 bg-brand/[.055] p-6 sm:p-8 print:hidden">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Your beat is licensed</p>
          <h1 className="mt-2 text-2xl font-semibold">Start creating while it is fresh</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Open a private Lyrics Pad with the purchased beat attached. BVS keeps the licence linked so it can flow into Rights Passport when you prepare the song for release.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {beatItems.map((item, index) => {
              const beatId = String(item.sourceId || item.id || '')
              return (
                <div key={`${beatId}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="font-semibold">{item.title || 'Licensed beat'}</p>
                  <p className="mt-1 text-sm text-text-secondary">{item.artist || 'BVS producer'}{item.licenceCode ? ` · ${item.licenceCode.replaceAll('_', ' ')}` : ''}</p>
                  <button type="button" disabled={openingBeat === beatId} onClick={() => void openLyricsPad(item)} className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{openingBeat === beatId ? 'Opening…' : 'Write to this beat →'}</button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 px-6 py-7 sm:px-9">
          <div><p className="text-xs uppercase tracking-[0.2em] text-brand">BVS Radio receipt</p><h1 className="mt-2 font-mono text-2xl font-semibold sm:text-3xl">{order.reference}</h1><p className="mt-2 text-sm text-text-secondary">{new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
          <div className="text-right"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass(order.status)}`}>{order.status.replaceAll('_', ' ')}</span><p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{money(order.total, currency)}</p></div>
        </header>

        <div className="px-6 py-6 sm:px-9">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">Items</h2>
          <div className="mt-4 space-y-0">{order.items.map((item, index) => <div key={`${item.id || item.title}-${index}`} className="flex justify-between gap-5 border-t border-white/10 py-4 first:border-t-0 first:pt-0"><div><p className="font-medium text-white">{item.title || 'BVS item'}</p><p className="mt-1 text-xs text-text-secondary">{[item.artist, item.type, `Qty ${item.quantity || 1}`, item.price != null ? `${money(item.price, currency)} each` : null].filter(Boolean).join(' · ')}</p></div><p className="shrink-0 tabular-nums">{money(Number(item.price || 0) * Number(item.quantity || 1), currency)}</p></div>)}</div>
          <dl className="mt-2 space-y-2 border-t border-white/10 pt-5 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-text-secondary">Subtotal</dt><dd className="tabular-nums">{money(order.subtotal, currency)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-secondary">{order.tax_label || 'Tax'}{order.tax_country ? ` (${order.tax_country})` : ''}{typeof order.tax_rate === 'number' && order.tax_rate > 0 ? ` · ${(order.tax_rate * 100).toFixed(0)}%` : ''}</dt><dd className="tabular-nums">{money(order.tax_amount, currency)}</dd></div>
            <div className="flex justify-between gap-4 text-lg font-semibold"><dt>Total</dt><dd className="tabular-nums text-brand">{money(order.total, currency)}</dd></div>
            <div className="flex justify-between gap-4 pt-2"><dt className="text-text-secondary">Payment method</dt><dd className="capitalize">{order.payment_method?.replaceAll('_', ' ') || 'Not recorded'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-secondary">Delivery</dt><dd className="capitalize">{order.delivery_status?.replaceAll('_', ' ') || 'Pending'}</dd></div>
          </dl>
        </div>

        {order.licenceSummary?.length > 0 && <section className="border-t border-white/10 px-6 py-6 sm:px-9"><h2 className="text-lg font-semibold">Licence record</h2><div className="mt-3 space-y-3">{order.licenceSummary.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"><p className="font-medium">{item.title}</p><p className="mt-1 text-sm leading-relaxed text-text-secondary">{item.licence}</p></div>)}</div></section>}

        <section className="border-t border-white/10 px-6 py-6 sm:px-9"><h2 className="text-lg font-semibold">Downloads</h2>{order.downloads.length ? <div className="mt-4 flex flex-wrap gap-3">{order.downloads.map((item) => <a key={item.itemId} href={item.href} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Download {item.title}</a>)}</div> : <p className="mt-2 text-sm leading-relaxed text-text-secondary">{paid ? 'No automatic file is staged for this item yet. BVS support will complete delivery when ready.' : 'Downloads unlock after payment is confirmed.'}</p>}</section>
        <div className="border-t border-white/10 px-6 py-5 sm:px-9 print:hidden"><button type="button" onClick={() => window.print()} className="rounded-full border border-white/20 px-5 py-2 text-sm hover:bg-white/5">Print / save PDF</button></div>
      </section>
      {error ? <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}
    </main>
  )
}
