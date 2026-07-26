'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type Item = { id?: string; title?: string; quantity?: number; price?: number }
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

export default function OrderReceiptPage() {
  const params = useParams<{ reference: string }>()
  const [order, setOrder] = useState<Receipt | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Account service unavailable.')
      setLoading(false)
      return
    }
    createClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token
      if (!token) {
        setError('Sign in to view this receipt.')
        setLoading(false)
        return
      }
      const response = await fetch(`/api/account/orders/${encodeURIComponent(params.reference)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) setError(payload.error || 'Could not load receipt.')
      else setOrder(payload.order)
      setLoading(false)
    })
  }, [params.reference])

  if (loading) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Loading receipt…</main>
  if (!order) return <main className="mx-auto min-h-[65vh] max-w-xl px-6 py-20 text-center"><h1 className="text-3xl">Receipt unavailable</h1><p className="mt-4 text-text-secondary">{error}</p><Link href="/account" className="mt-6 inline-block text-brand">← Account Centre</Link></main>

  return <main className="mx-auto max-w-3xl px-6 py-12">
    <div className="print:hidden"><Link href="/account" className="text-sm text-brand">← Account Centre</Link></div>
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.025] p-6 sm:p-9">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs uppercase tracking-[.2em] text-brand">BVS Radio receipt</p><h1 className="mt-2 text-3xl font-semibold">{order.reference}</h1><p className="mt-2 text-sm text-text-secondary">{new Date(order.created_at).toLocaleString()}</p></div><div className="text-right"><p className="text-sm capitalize text-brand">{order.status.replaceAll('_', ' ')}</p><p className="mt-1 text-3xl font-semibold">{money(order.total, order.currency || 'USD')}</p></div></div>
      <div className="mt-8 space-y-3">{order.items.map((item, index) => <div key={`${item.id || item.title}-${index}`} className="flex justify-between gap-5 border-t border-white/10 pt-3"><div><p className="font-medium">{item.title || 'BVS item'}</p><p className="text-xs text-text-secondary">Quantity {item.quantity || 1}</p></div><p>{money(Number(item.price || 0) * Number(item.quantity || 1), order.currency || 'USD')}</p></div>)}</div>
      <dl className="mt-7 grid gap-2 border-t border-white/10 pt-5 text-sm"><div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd>{money(order.subtotal, order.currency || 'USD')}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">{order.tax_label || 'Tax'}{order.tax_country ? ` (${order.tax_country})` : ''}</dt><dd>{money(order.tax_amount, order.currency || 'USD')}</dd></div><div className="flex justify-between text-lg font-semibold"><dt>Total</dt><dd>{money(order.total, order.currency || 'USD')}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Payment</dt><dd className="capitalize">{order.payment_method?.replaceAll('_', ' ') || 'Not recorded'}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Delivery</dt><dd className="capitalize">{order.delivery_status?.replaceAll('_', ' ') || 'Pending'}</dd></div></dl>
      <section className="mt-8 border-t border-white/10 pt-6"><h2 className="text-xl font-semibold">Purchase and licence record</h2><div className="mt-3 space-y-3">{order.licenceSummary.map((item, index) => <div key={`${item.title}-${index}`}><p className="font-medium">{item.title}</p><p className="text-sm text-text-secondary">{item.licence}</p></div>)}</div></section>
      <section className="mt-8 border-t border-white/10 pt-6"><h2 className="text-xl font-semibold">Downloads</h2>{order.downloads.length ? <div className="mt-4 flex flex-wrap gap-3">{order.downloads.map(item => <a key={item.itemId} href={item.href} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Download {item.title}</a>)}</div> : <p className="mt-2 text-sm text-text-secondary">{['paid','fulfilled'].includes(order.status) ? 'No automatic file is staged for this item. BVS support will complete delivery.' : 'Downloads unlock after payment is confirmed.'}</p>}</section>
      <button type="button" onClick={() => window.print()} className="mt-8 rounded-full border border-white/20 px-5 py-2 text-sm print:hidden">Print / save receipt</button>
    </section>
  </main>
}
