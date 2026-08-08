'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type FinanceData = {
  generatedAt: string
  period: { quarter: string; monthStart: string; quarterStart: string }
  current: {
    paidArtists: number | null
    activeArtistMemberships: number | null
    subscriptionMrr: number | null
    newsletterSubscribers: number | null
    monthMarketplaceGmv: number
    monthMarketplaceOrders: number
    quarterMarketplaceGmv: number
    quarterMarketplaceOrders: number
  }
  accounting: {
    quarterGmv: number
    quarterCheckout: number
    quarterTax: number
    quarterArtistSaleCredits: number | null
    contributionBeforeProcessor: number | null
    walletLiability: number | null
    processorFees: number | null
    grossProfit: number | null
  }
  controls: { paidOrders: number; verifiedPaymentEvents: number | null; reconciledPaymentEvents: number | null; unresolvedPaymentEvents: number | null }
  availability: Record<string, boolean>
}

const targets = [
  { quarter: 'Q3 2026', artists: null, gmv: null, newsletter: null, outcome: 'Control: reconcile 100% of verified sales' },
  { quarter: 'Q4 2026', artists: 25, gmv: 1000, newsletter: 150, outcome: 'Three positive gross-contribution months' },
  { quarter: 'Q1 2027', artists: 60, gmv: 2500, newsletter: 350, outcome: 'Recurring contribution covers 60% of fixed OPEX' },
  { quarter: 'Q2 2027', artists: 100, gmv: 5000, newsletter: 600, outcome: 'Two positive free-cash-flow months' },
]

function usd(value: number | null) {
  return value == null ? 'Not connected' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function Metric({ label, value, note, warning = false }: { label: string; value: string | number; note?: string; warning?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${warning ? 'border-amber-400/30 bg-amber-400/[.06]' : 'border-white/10 bg-white/[.03]'}`}><p className="text-xs uppercase tracking-[.12em] text-text-secondary">{label}</p><p className={`mt-2 text-2xl font-semibold ${warning ? 'text-amber-200' : 'text-brand'}`}>{value}</p>{note ? <p className="mt-2 text-xs text-text-secondary">{note}</p> : null}</div>
}

function TargetChart({ title, unit, values, actual }: { title: string; unit: 'count' | 'usd'; values: Array<number | null>; actual: number | null }) {
  const max = Math.max(1, ...values.map((value) => value || 0), actual || 0)
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h3 className="font-semibold">{title}</h3><div className="mt-6 grid h-52 grid-cols-4 items-end gap-3 border-b border-white/10 px-2">{values.map((value, index) => { const height = value == null ? 4 : Math.max(8, (value / max) * 170); const current = targets[index].quarter === 'Q3 2026'; return <div key={targets[index].quarter} className="flex h-full flex-col items-center justify-end"><span className="mb-2 text-xs text-text-secondary">{value == null ? 'Baseline' : unit === 'usd' ? `$${value.toLocaleString()}` : value}</span><div className="relative w-full max-w-16 rounded-t bg-brand/75" style={{ height }} title={`${targets[index].quarter} target`} >{current && actual != null ? <div className="absolute inset-x-0 border-t-2 border-emerald-300" style={{ bottom: Math.min(height, Math.max(2, (actual / max) * 170)) }}><span className="absolute -top-5 right-0 text-[10px] text-emerald-300">Actual {unit === 'usd' ? `$${actual.toLocaleString()}` : actual}</span></div> : null}</div><span className="mt-2 text-[11px] text-text-secondary">{targets[index].quarter.replace('20', '’')}</span></div> })}</div></div>
}

export default function EditorialFinancePage() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.')
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Sign in with an active Editorial staff account.')
      const response = await fetch('/api/admin/editorial/finance', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not load finance statistics.')
      setData(payload)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load finance statistics.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  const quarterIndex = useMemo(() => data ? targets.findIndex((target) => target.quarter === data.period.quarter) : 0, [data])

  return <main className="mx-auto max-w-7xl px-6 py-12">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><Link href="/editorial" className="text-sm text-brand hover:underline">← Editorial workflow</Link><p className="mt-5 text-xs uppercase tracking-[.22em] text-brand">Accounting & performance</p><h1 className="mt-2 text-4xl font-semibold">Quarterly management control</h1><p className="mt-3 max-w-3xl text-text-secondary">TOPSIM-style goals versus live BVS operating data. GMV, revenue, artist liabilities, tax and cash contribution remain separate.</p></div><button onClick={() => void load()} className="rounded-full border border-white/20 px-5 py-2 text-sm">Refresh live statistics</button></div>

    {loading && !data ? <div className="mt-8 animate-pulse rounded-2xl border border-white/10 p-10 text-text-secondary">Loading protected finance statistics…</div> : null}
    {error ? <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-red-200">{error} <button onClick={() => void load()} className="ml-2 underline">Retry</button></div> : null}

    {data ? <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Paid artist subscribers" value={data.current.paidArtists ?? 'Not connected'} note={`${data.current.activeArtistMemberships ?? 0} active/trial memberships`} /><Metric label="Marketplace GMV this month" value={usd(data.current.monthMarketplaceGmv)} note={`${data.current.monthMarketplaceOrders} paid marketplace orders`} /><Metric label="Subscription MRR" value={usd(data.current.subscriptionMrr)} note="Monthly equivalent of active paid artist plans" /><Metric label="Newsletter subscribers" value={data.current.newsletterSubscribers ?? 'Not connected'} note={data.availability.newsletter ? 'Active opt-ins' : 'Newsletter data source has not shipped yet'} warning={!data.availability.newsletter} /></section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3"><TargetChart title="Paying artists — target trajectory" unit="count" values={targets.map((target) => target.artists)} actual={data.current.paidArtists} /><TargetChart title="Monthly marketplace GMV — target trajectory" unit="usd" values={targets.map((target) => target.gmv)} actual={data.current.monthMarketplaceGmv} /><TargetChart title="Newsletter opt-ins — target trajectory" unit="count" values={targets.map((target) => target.newsletter)} actual={data.current.newsletterSubscribers} /></section>

      <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Management period</p><h2 className="mt-2 text-2xl font-semibold">{data.period.quarter}: target versus current</h2></div><p className="text-xs text-text-secondary">Updated {new Date(data.generatedAt).toLocaleString()}</p></div><div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/[.04] text-left text-xs uppercase tracking-[.1em] text-text-secondary"><tr><th className="p-4">KPI</th><th className="p-4">Quarter goal</th><th className="p-4">Current</th><th className="p-4">Management interpretation</th></tr></thead><tbody className="divide-y divide-white/10"><tr><td className="p-4">Paid artists</td><td className="p-4">{targets[quarterIndex]?.artists ?? 'Measure baseline'}</td><td className="p-4 text-brand">{data.current.paidArtists ?? 'Not connected'}</td><td className="p-4 text-text-secondary">Count only provider-backed active artist plans.</td></tr><tr><td className="p-4">Monthly marketplace GMV</td><td className="p-4">{targets[quarterIndex]?.gmv ? `$${targets[quarterIndex].gmv?.toLocaleString()}` : 'Measure baseline'}</td><td className="p-4 text-brand">{usd(data.current.monthMarketplaceGmv)}</td><td className="p-4 text-text-secondary">Gross merchandise value; not BVS revenue.</td></tr><tr><td className="p-4">Newsletter opt-ins</td><td className="p-4">{targets[quarterIndex]?.newsletter ?? 'Launch + baseline'}</td><td className="p-4 text-brand">{data.current.newsletterSubscribers ?? 'Not connected'}</td><td className="p-4 text-text-secondary">Consent-based active subscribers only.</td></tr><tr><td className="p-4">Quarter outcome</td><td className="p-4" colSpan={2}>{targets[quarterIndex]?.outcome}</td><td className="p-4 text-text-secondary">Reviewed at quarterly close.</td></tr></tbody></table></div></section>

      <section className="mt-10"><p className="text-xs uppercase tracking-[.18em] text-brand">Accounting view</p><h2 className="mt-2 text-2xl font-semibold">Quarter-to-date money flow</h2><p className="mt-2 text-sm text-text-secondary">Marketplace standard: distinguish checkout cash, tax payable, artist payable and BVS contribution.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Customer checkout receipts" value={usd(data.accounting.quarterCheckout)} note="Includes tax collected" /><Metric label="GMV / pre-tax sales" value={usd(data.accounting.quarterGmv)} note="Not automatically BVS revenue" /><Metric label="Tax collected" value={usd(data.accounting.quarterTax)} note="Tax liability, not profit" /><Metric label="Artist wallet liability" value={usd(data.accounting.walletLiability)} note="Posted credits less posted debits" /><Metric label="Artist sale credits this quarter" value={usd(data.accounting.quarterArtistSaleCredits)} /><Metric label="Contribution before processor" value={usd(data.accounting.contributionBeforeProcessor)} note="Pre-tax GMV less artist sale credits; not gross profit" /><Metric label="Processor fees" value="Not connected" note="Must be synced from Stripe/Paynow balance data" warning /><Metric label="Gross profit / free cash flow" value="Not calculated" note="Blocked until processor fees and full OPEX are captured" warning /></div></section>

      <section className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.2fr]"><div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="text-xl font-semibold">Payment controls</h2><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Paid orders" value={data.controls.paidOrders} /><Metric label="Verified events" value={data.controls.verifiedPaymentEvents ?? 'Not connected'} /><Metric label="Reconciled events" value={data.controls.reconciledPaymentEvents ?? 'Not connected'} /><Metric label="Unresolved events" value={data.controls.unresolvedPaymentEvents ?? 'Not connected'} warning={Boolean(data.controls.unresolvedPaymentEvents)} /></div></div><div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="text-xl font-semibold">Industry-standard management stack</h2><ol className="mt-4 space-y-3 text-sm text-text-secondary"><li><strong className="text-text-primary">1. Growth:</strong> paid artists, MRR, GMV, orders, newsletter conversion.</li><li><strong className="text-text-primary">2. Unit economics:</strong> take rate, processor cost, contribution margin by product/channel.</li><li><strong className="text-text-primary">3. Retention:</strong> subscriber churn, artist cohort retention and repeat purchase rate.</li><li><strong className="text-text-primary">4. Accounting controls:</strong> settlement reconciliation, tax payable, artist payable and refund reserves.</li><li><strong className="text-text-primary">5. Cash:</strong> operating expenses, free cash flow, runway and scenario forecast.</li></ol></div></section>

      <div className="mt-10 rounded-2xl border border-brand/25 bg-brand/[.06] p-5 text-sm"><strong>Core rule:</strong> Revenue − artist payout − processor fees − refunds − variable costs − fixed OPEX = real BVS cash flow. Until all components are captured, the dashboard deliberately avoids claiming profit.</div>
    </> : null}
  </main>
}
