'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { calculateMarketplaceEconomics, processorFeeFromPreset } from '@/lib/marketplace-economics'

type FinanceData = {
  generatedAt: string
  role: string
  canMutatePolicy: boolean
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
    pendingArtistSaleCredits: number | null
    contributionBeforeProcessor: number | null
    walletLiability: number | null
    processorFees: number | null
    sellerProcessorFees: number | null
    bvsAbsorbedProcessor: number | null
    bvsPlatformFees: number | null
    contributionAfterProcessor: number | null
    grossProfit: number | null
  }
  controls: {
    paidOrders: number
    verifiedPaymentEvents: number | null
    reconciledPaymentEvents: number | null
    unresolvedPaymentEvents: number | null
    pendingProcessorSettlements: number | null
  }
  policy: {
    version: string
    effectiveAt: string
    basketTargetUsd: number
    rules: string[]
    processorPresets: Array<{ id: string; label: string; provider: string; percent: number; fixed: number; fixedCurrency: string; status: string; note: string }>
    examples: Array<{ id: string; label: string; productType: string; price: number; sellerPlanId: string; commissionBps: number | null }>
    producerBreakEven: { freeToPlusMonthlyGmv: number | null; plusToProMonthlyGmv: number | null }
    creatorComplete: { monthlyUsd: number; yearlyUsd: number; status: string }
  }
  recentSettlements: Array<Record<string, unknown>>
  caseStudy: {
    reference: string
    found: boolean
    order: Record<string, unknown> | null
    knownHistorical: {
      customerPaid: number
      productPrice: number
      vat: number
      proposedCommissionBps: number
      bvsFee: number
      stripeFeeNative: number
      stripeFeeNativeCurrency: string
      stripeFeeApproxUsd: number
      correctSellerNetApproxUsd: number
      sourceLabel: string
    }
    existingLedgerCredit: Record<string, unknown> | null
    legacyWarning: string | null
  }
  guidance: { moneyFlow: string[]; tax: string[] }
  availability: Record<string, boolean>
}

const targets = [
  { quarter: 'Q3 2026', artists: null, gmv: null, newsletter: null, outcome: 'Control: reconcile 100% of verified sales' },
  { quarter: 'Q4 2026', artists: 25, gmv: 1000, newsletter: 150, outcome: 'Three positive gross-contribution months' },
  { quarter: 'Q1 2027', artists: 60, gmv: 2500, newsletter: 350, outcome: 'Recurring contribution covers 60% of fixed OPEX' },
  { quarter: 'Q2 2027', artists: 100, gmv: 5000, newsletter: 600, outcome: 'Two positive free-cash-flow months' },
]

function usd(value: number | null | undefined) {
  return value == null ? 'Not connected' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function Metric({ label, value, note, warning = false }: { label: string; value: string | number; note?: string; warning?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${warning ? 'border-amber-400/30 bg-amber-400/[.06]' : 'border-white/10 bg-white/[.03]'}`}><p className="text-xs uppercase tracking-[.12em] text-text-secondary">{label}</p><p className={`mt-2 text-2xl font-semibold ${warning ? 'text-amber-200' : 'text-brand'}`}>{value}</p>{note ? <p className="mt-2 text-xs text-text-secondary">{note}</p> : null}</div>
}

function TargetChart({ title, unit, values, actual }: { title: string; unit: 'count' | 'usd'; values: Array<number | null>; actual: number | null }) {
  const max = Math.max(1, ...values.map((value) => value || 0), actual || 0)
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h3 className="font-semibold">{title}</h3><div className="mt-6 grid h-52 grid-cols-4 items-end gap-3 border-b border-white/10 px-2">{values.map((value, index) => { const height = value == null ? 4 : Math.max(8, (value / max) * 170); const current = targets[index].quarter === 'Q3 2026'; return <div key={targets[index].quarter} className="flex h-full flex-col items-center justify-end"><span className="mb-2 text-xs text-text-secondary">{value == null ? 'Baseline' : unit === 'usd' ? `$${value.toLocaleString()}` : value}</span><div className="relative w-full max-w-16 rounded-t bg-brand/75" style={{ height }} title={`${targets[index].quarter} target`}>{current && actual != null ? <div className="absolute inset-x-0 border-t-2 border-emerald-300" style={{ bottom: Math.min(height, Math.max(2, (actual / max) * 170)) }}><span className="absolute -top-5 right-0 text-[10px] text-emerald-300">Actual {unit === 'usd' ? `$${actual.toLocaleString()}` : actual}</span></div> : null}</div><span className="mt-2 text-[11px] text-text-secondary">{targets[index].quarter.replace('20', '’')}</span></div> })}</div></div>
}

export default function EditorialFinancePage() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [calcExampleId, setCalcExampleId] = useState('beat_free')
  const [taxRate, setTaxRate] = useState(0)
  const [processorPresetId, setProcessorPresetId] = useState('paynow_ecocash')
  const [manualProcessorFee, setManualProcessorFee] = useState<number | null>(null)
  const [reconcile, setReconcile] = useState({ reference: '', provider: 'paynow', fee: '', nativeAmount: '', nativeCurrency: 'USD', status: 'actual' })
  const [reconcileMessage, setReconcileMessage] = useState('')

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

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])
  const quarterIndex = useMemo(() => data ? targets.findIndex((target) => target.quarter === data.period.quarter) : 0, [data])

  const selectedExample = data?.policy.examples.find((item) => item.id === calcExampleId) || data?.policy.examples[0]
  const presetFee = selectedExample && data
    ? processorFeeFromPreset(selectedExample.price * (1 + taxRate / 100), processorPresetId)
    : null
  const processorFee = manualProcessorFee == null ? (presetFee || 0) : manualProcessorFee
  const calculation = selectedExample && selectedExample.commissionBps != null
    ? calculateMarketplaceEconomics({ productPrice: selectedExample.price, taxRatePercent: taxRate, commissionBps: selectedExample.commissionBps, processorFee })
    : null

  const submitReconcile = useCallback(async () => {
    setReconcileMessage('')
    if (!data?.canMutatePolicy) return
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) return setReconcileMessage('Sign in again.')
    const response = await fetch('/api/admin/editorial/finance/processor-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        reference: reconcile.reference,
        provider: reconcile.provider,
        amountOrderCurrency: Number(reconcile.fee),
        nativeAmount: reconcile.nativeAmount ? Number(reconcile.nativeAmount) : null,
        nativeCurrency: reconcile.nativeCurrency,
        status: reconcile.status,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return setReconcileMessage(payload.error || 'Could not reconcile processor fee.')
    setReconcileMessage('Processor fee reconciled; seller settlement and wallet entry refreshed.')
    await load()
  }, [data?.canMutatePolicy, load, reconcile])

  return <main className="mx-auto max-w-7xl px-6 py-12">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><Link href="/editorial" className="text-sm text-brand hover:underline">← Editorial workflow</Link><p className="mt-5 text-xs uppercase tracking-[.22em] text-brand">Accounting & performance</p><h1 className="mt-2 text-4xl font-semibold">Quarterly management control</h1><p className="mt-3 max-w-3xl text-text-secondary">GMV, BVS revenue, tax liabilities, creator liabilities and processor costs stay separate. The Finance desk never labels incomplete data as profit.</p></div><button onClick={() => void load()} className="rounded-full border border-white/20 px-5 py-2 text-sm">Refresh live statistics</button></div>

    {loading && !data ? <div className="mt-8 animate-pulse rounded-2xl border border-white/10 p-10 text-text-secondary">Loading protected finance statistics…</div> : null}
    {error ? <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-red-200">{error} <button onClick={() => void load()} className="ml-2 underline">Retry</button></div> : null}

    {data ? <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Paid artist subscribers" value={data.current.paidArtists ?? 'Not connected'} note={`${data.current.activeArtistMemberships ?? 0} active/trial memberships`} /><Metric label="Marketplace GMV this month" value={usd(data.current.monthMarketplaceGmv)} note={`${data.current.monthMarketplaceOrders} paid marketplace orders`} /><Metric label="Subscription MRR" value={usd(data.current.subscriptionMrr)} note="Monthly equivalent of active paid artist plans" /><Metric label="Newsletter subscribers" value={data.current.newsletterSubscribers ?? 'Not connected'} note={data.availability.newsletter ? 'Active opt-ins' : 'Newsletter data source has not shipped yet'} warning={!data.availability.newsletter} /></section>

      <section className="mt-10 rounded-3xl border border-brand/25 bg-brand/[.045] p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Marketplace Economics</p><h2 className="mt-2 text-3xl font-semibold">Protect BVS commission. Keep creator deductions transparent.</h2><p className="mt-3 max-w-4xl text-sm text-text-secondary">Policy {data.policy.version} · effective {new Date(data.policy.effectiveAt).toLocaleDateString()}. Payment processing is a transaction cost allocated to seller proceeds by default. BVS can subsidize it only through an explicit measured benefit.</p></div><span className="rounded-full border border-white/15 px-3 py-1 text-xs text-text-secondary">{data.canMutatePolicy ? 'Finance policy controls enabled' : 'Read-only finance view'}</span></div>

        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">{data.guidance.moneyFlow.map((step, index) => <div key={step} className="flex items-center gap-2"><span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{step}</span>{index < data.guidance.moneyFlow.length - 1 ? <span className="text-brand">→</span> : null}</div>)}</div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric label="BVS platform fees QTD" value={usd(data.accounting.bvsPlatformFees)} note="Commission on pre-tax product revenue" /><Metric label="Processor fees observed" value={usd(data.accounting.processorFees)} note="Actual/schedule fee totals only" warning={!data.availability.processorFees} /><Metric label="Creator processor allocation" value={usd(data.accounting.sellerProcessorFees)} note="Deducted separately from seller proceeds" /><Metric label="BVS contribution after processing" value={usd(data.accounting.contributionAfterProcessor)} note="Before hosting, staff, refunds, marketing and tax" /></div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-2xl border border-white/10 bg-black/15 p-5"><h3 className="text-xl font-semibold">Policy example calculator</h3><p className="mt-2 text-sm text-text-secondary">Examples are educational. Live Finance uses stored settlement data; estimates are never presented as booked profit.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs text-text-secondary">Product / tier<select value={calcExampleId} onChange={(event) => { setCalcExampleId(event.target.value); setManualProcessorFee(null) }} className="mt-1 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary">{data.policy.examples.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs text-text-secondary">Processor preset<select value={processorPresetId} onChange={(event) => { setProcessorPresetId(event.target.value); setManualProcessorFee(null) }} className="mt-1 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary">{data.policy.processorPresets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs text-text-secondary">VAT / sales tax %<input value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value) || 0)} type="number" min="0" step="0.1" className="mt-1 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm" /></label><label className="text-xs text-text-secondary">Processor fee override (USD)<input value={manualProcessorFee ?? ''} onChange={(event) => setManualProcessorFee(event.target.value === '' ? null : Number(event.target.value))} type="number" min="0" step="0.01" placeholder={presetFee == null ? 'Not connected' : String(presetFee)} className="mt-1 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm" /></label></div>{calculation ? <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Product price" value={usd(calculation.productPrice)} /><Metric label="VAT / tax" value={usd(calculation.tax)} note="Never commissionable" /><Metric label="BVS platform fee" value={usd(calculation.commission)} note={`${((selectedExample?.commissionBps || 0) / 100).toFixed(1)}%`} /><Metric label="Processor fee" value={usd(calculation.processorFee)} note={manualProcessorFee == null ? 'Preset / estimate unless settlement-backed' : 'Manual example'} /><Metric label="Creator earns" value={usd(calculation.sellerNet)} /><Metric label="BVS contribution" value={usd(calculation.bvsContributionAfterProcessing)} note="Seller pays processing in this model" /></div> : <p className="mt-5 text-sm text-amber-200">No approved fee exists for this future product type.</p>}</div>

          <div className="rounded-2xl border border-white/10 bg-black/15 p-5"><h3 className="text-xl font-semibold">Why Premium can pay for itself</h3><p className="mt-3 text-sm text-text-secondary">Producer Free → Plus saves 7 percentage points. Plus → Pro saves another 5 points.</p><div className="mt-5 space-y-3"><Metric label="Free → Plus break-even" value={usd(data.policy.producerBreakEven.freeToPlusMonthlyGmv)} note="Approx monthly BeatStore GMV where the $5 Plus subscription is offset by lower commission" /><Metric label="Plus → Pro break-even" value={usd(data.policy.producerBreakEven.plusToProMonthlyGmv)} note="Approx monthly GMV where the additional $10 Pro price is offset by another 5 points" /><Metric label="Creator Complete" value={`$${data.policy.creatorComplete.monthlyUsd}/mo · $${data.policy.creatorComplete.yearlyUsd}/yr`} note="Planned: Artist Standard + Producer Pro under $20/month" /></div><div className="mt-5 rounded-xl border border-brand/20 bg-brand/[.06] p-4 text-sm"><strong>Commercial rule:</strong> BVS should make more when creators make more, but BVS should not lose money because a successful creator upgraded to the lowest-fee tier.</div></div></div>
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 p-6"><p className="text-xs uppercase tracking-[.18em] text-brand">BasJunior case study</p><h2 className="mt-2 text-2xl font-semibold">{data.caseStudy.reference}</h2><p className="mt-2 text-sm text-text-secondary">Historical learning example. It does not silently rewrite the existing ledger.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Customer paid" value={usd(data.caseStudy.knownHistorical.customerPaid)} /><Metric label="Product revenue" value={usd(data.caseStudy.knownHistorical.productPrice)} /><Metric label="VAT" value={usd(data.caseStudy.knownHistorical.vat)} /><Metric label="BVS fee @ 20%" value={usd(data.caseStudy.knownHistorical.bvsFee)} /><Metric label="Stripe fee" value={`€${data.caseStudy.knownHistorical.stripeFeeNative.toFixed(2)}`} note={`≈ ${usd(data.caseStudy.knownHistorical.stripeFeeApproxUsd)}`} /><Metric label="Correct creator net" value={usd(data.caseStudy.knownHistorical.correctSellerNetApproxUsd)} /></div>{data.caseStudy.legacyWarning ? <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[.07] p-4 text-sm text-amber-100">{data.caseStudy.legacyWarning}</div> : null}<p className="mt-3 text-xs text-text-secondary">{data.caseStudy.knownHistorical.sourceLabel}</p></section>

      <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Live sale breakdowns</p><h2 className="mt-2 text-2xl font-semibold">Settlement ledger</h2></div><p className="text-xs text-text-secondary">Actual, schedule, estimated and not-connected processor fees are labelled separately.</p></div><div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/[.04] text-left text-xs uppercase tracking-[.1em] text-text-secondary"><tr><th className="p-4">Order</th><th className="p-4">Plan</th><th className="p-4">Gross</th><th className="p-4">BVS fee</th><th className="p-4">Processing</th><th className="p-4">Creator net</th><th className="p-4">State</th></tr></thead><tbody className="divide-y divide-white/10">{data.recentSettlements.length ? data.recentSettlements.map((row) => <tr key={String(row.id)}><td className="p-4">{String(row.order_reference || '')}</td><td className="p-4 text-text-secondary">{String(row.seller_plan_id || 'free')}</td><td className="p-4">{usd(Number(row.gross_product_revenue || 0))}</td><td className="p-4">{usd(Number(row.platform_fee_amount || 0))}</td><td className="p-4">{usd(Number(row.processor_fee_allocated || 0))}<div className="text-[10px] uppercase text-text-secondary">{String(row.processor_fee_status || '')}</div></td><td className="p-4 text-brand">{usd(Number(row.seller_net || 0))}</td><td className="p-4">{String(row.settlement_status || '')}</td></tr>) : <tr><td className="p-5 text-text-secondary" colSpan={7}>No seller settlement rows yet. Run the marketplace economics SQL migration before enabling this policy in production.</td></tr>}</tbody></table></div></section>

      {data.canMutatePolicy ? <section className="mt-10 rounded-2xl border border-white/10 bg-white/[.025] p-6"><p className="text-xs uppercase tracking-[.18em] text-brand">Restricted control</p><h2 className="mt-2 text-xl font-semibold">Reconcile a processor fee</h2><p className="mt-2 text-sm text-text-secondary">Founder, Administrator and Commerce Manager only. Use actual settlement data or a confirmed Paynow channel schedule. This posts a previously pending seller credit.</p><div className="mt-5 grid gap-3 md:grid-cols-3"><input value={reconcile.reference} onChange={(e) => setReconcile((v) => ({ ...v, reference: e.target.value }))} placeholder="Order reference" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm" /><select value={reconcile.provider} onChange={(e) => setReconcile((v) => ({ ...v, provider: e.target.value }))} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm"><option value="paynow">Paynow</option><option value="stripe">Stripe</option></select><select value={reconcile.status} onChange={(e) => setReconcile((v) => ({ ...v, status: e.target.value }))} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm"><option value="actual">Actual settlement</option><option value="schedule">Confirmed fee schedule</option></select><input value={reconcile.fee} onChange={(e) => setReconcile((v) => ({ ...v, fee: e.target.value }))} placeholder="Fee in order currency" type="number" min="0" step="0.01" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm" /><input value={reconcile.nativeAmount} onChange={(e) => setReconcile((v) => ({ ...v, nativeAmount: e.target.value }))} placeholder="Native fee (optional)" type="number" min="0" step="0.01" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm" /><input value={reconcile.nativeCurrency} onChange={(e) => setReconcile((v) => ({ ...v, nativeCurrency: e.target.value.toUpperCase() }))} placeholder="Native currency" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm" /></div><button onClick={() => void submitReconcile()} className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Reconcile fee</button>{reconcileMessage ? <p className="mt-3 text-sm text-text-secondary">{reconcileMessage}</p> : null}</section> : null}

      <section className="mt-10 grid gap-4 lg:grid-cols-3"><TargetChart title="Paying artists — target trajectory" unit="count" values={targets.map((target) => target.artists)} actual={data.current.paidArtists} /><TargetChart title="Monthly marketplace GMV — target trajectory" unit="usd" values={targets.map((target) => target.gmv)} actual={data.current.monthMarketplaceGmv} /><TargetChart title="Newsletter opt-ins — target trajectory" unit="count" values={targets.map((target) => target.newsletter)} actual={data.current.newsletterSubscribers} /></section>

      <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Management period</p><h2 className="mt-2 text-2xl font-semibold">{data.period.quarter}: target versus current</h2></div><p className="text-xs text-text-secondary">Updated {new Date(data.generatedAt).toLocaleString()}</p></div><div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/[.04] text-left text-xs uppercase tracking-[.1em] text-text-secondary"><tr><th className="p-4">KPI</th><th className="p-4">Quarter goal</th><th className="p-4">Current</th><th className="p-4">Management interpretation</th></tr></thead><tbody className="divide-y divide-white/10"><tr><td className="p-4">Paid artists</td><td className="p-4">{targets[quarterIndex]?.artists ?? 'Measure baseline'}</td><td className="p-4 text-brand">{data.current.paidArtists ?? 'Not connected'}</td><td className="p-4 text-text-secondary">Count only provider-backed active artist plans.</td></tr><tr><td className="p-4">Monthly marketplace GMV</td><td className="p-4">{targets[quarterIndex]?.gmv ? `$${targets[quarterIndex].gmv?.toLocaleString()}` : 'Measure baseline'}</td><td className="p-4 text-brand">{usd(data.current.monthMarketplaceGmv)}</td><td className="p-4 text-text-secondary">Gross merchandise value; not BVS revenue.</td></tr><tr><td className="p-4">Quarter outcome</td><td className="p-4" colSpan={2}>{targets[quarterIndex]?.outcome}</td><td className="p-4 text-text-secondary">Reviewed at quarterly close.</td></tr></tbody></table></div></section>

      <section className="mt-10"><p className="text-xs uppercase tracking-[.18em] text-brand">Accounting view</p><h2 className="mt-2 text-2xl font-semibold">Quarter-to-date money flow</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Customer checkout receipts" value={usd(data.accounting.quarterCheckout)} note="Includes tax collected" /><Metric label="GMV / pre-tax sales" value={usd(data.accounting.quarterGmv)} note="Not automatically BVS revenue" /><Metric label="Tax collected" value={usd(data.accounting.quarterTax)} note="Tax liability, not profit" /><Metric label="Creator wallet liability" value={usd(data.accounting.walletLiability)} note="Posted credits less posted debits" /><Metric label="Posted creator sale credits" value={usd(data.accounting.quarterArtistSaleCredits)} /><Metric label="Pending creator sale credits" value={usd(data.accounting.pendingArtistSaleCredits)} note="Waiting for processor reconciliation" warning={Boolean(data.accounting.pendingArtistSaleCredits)} /><Metric label="BVS marketplace contribution" value={usd(data.accounting.contributionAfterProcessor)} note="Before fixed OPEX" /><Metric label="Gross profit / free cash flow" value="Not calculated" note="Requires complete OPEX, refunds and tax accounting" warning /></div></section>

      <section className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.2fr]"><div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="text-xl font-semibold">Payment controls</h2><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Paid orders" value={data.controls.paidOrders} /><Metric label="Verified events" value={data.controls.verifiedPaymentEvents ?? 'Not connected'} /><Metric label="Unresolved events" value={data.controls.unresolvedPaymentEvents ?? 'Not connected'} warning={Boolean(data.controls.unresolvedPaymentEvents)} /><Metric label="Pending fee settlements" value={data.controls.pendingProcessorSettlements ?? 'Not connected'} warning={Boolean(data.controls.pendingProcessorSettlements)} /></div></div><div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="text-xl font-semibold">Tax and payout guidance</h2><ul className="mt-4 space-y-3 text-sm text-text-secondary">{data.guidance.tax.map((line) => <li key={line}>• {line}</li>)}</ul></div></section>

      <div className="mt-10 rounded-2xl border border-brand/25 bg-brand/[.06] p-5 text-sm"><strong>Core rule:</strong> customer tax is not BVS revenue; BVS commission is calculated on pre-tax product revenue; processor cost is allocated transparently; creator wallet balances only become payout-available after the settlement is posted.</div>
    </> : null}
  </main>
}
