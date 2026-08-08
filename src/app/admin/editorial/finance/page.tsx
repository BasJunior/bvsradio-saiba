'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { calculateMarketplaceEconomics, processorFeeFromPreset } from '@/lib/marketplace-economics'

type Example = {
  id: string
  label: string
  productType: string
  price: number
  sellerPlanId: string
  revenueModel: 'marketplace' | 'bvs_subscription' | 'future'
  commissionBps: number | null
  processorAllocation: 'seller' | 'bvs' | 'unknown'
  note?: string
}

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
    quarterRefundDebits: number | null
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
    refundEvents: number | null
  }
  policy: {
    version: string
    effectiveAt: string
    basketTargetUsd: number
    rules: string[]
    processorPresets: Array<{ id: string; label: string; provider: string; percent: number; fixed: number; fixedCurrency: string; status: string; note: string }>
    examples: Example[]
    feeTable: Array<{ client: string; subscription: string; product: string; platformFee: string; processing: string }>
    audit: Array<Record<string, unknown>>
    producerBreakEven: { freeToPlusMonthlyGmv: number | null; plusToProMonthlyGmv: number | null }
    creatorComplete: { monthlyUsd: number; yearlyUsd: number; status: string }
  }
  recentSettlements: Array<Record<string, unknown>>
  recentRefundEvents: Array<Record<string, unknown>>
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
  { quarter: 'Q3 2026', artists: null, gmv: null, newsletter: null, outcome: 'Reconcile 100% of verified sales and establish the contribution baseline.' },
  { quarter: 'Q4 2026', artists: 25, gmv: 1000, newsletter: 150, outcome: 'Three positive marketplace-contribution months.' },
  { quarter: 'Q1 2027', artists: 60, gmv: 2500, newsletter: 350, outcome: 'Recurring contribution covers 60% of fixed OPEX.' },
  { quarter: 'Q2 2027', artists: 100, gmv: 5000, newsletter: 600, outcome: 'Two positive free-cash-flow months.' },
]

function usd(value: number | null | undefined) {
  return value == null ? 'Not connected' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function Metric({ label, value, note, warning = false }: { label: string; value: string | number; note?: string; warning?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${warning ? 'border-amber-400/30 bg-amber-400/[.06]' : 'border-white/10 bg-white/[.03]'}`}><p className="text-xs uppercase tracking-[.12em] text-text-secondary">{label}</p><p className={`mt-2 text-2xl font-semibold ${warning ? 'text-amber-200' : 'text-brand'}`}>{value}</p>{note ? <p className="mt-2 text-xs text-text-secondary">{note}</p> : null}</div>
}

function Flow({ steps }: { steps: string[] }) {
  return <div className="flex flex-wrap items-center gap-2 text-sm">{steps.map((step, index) => <div key={step} className="flex items-center gap-2"><span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{step}</span>{index < steps.length - 1 ? <span className="font-semibold text-brand">→</span> : null}</div>)}</div>
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
  const [reversal, setReversal] = useState({ reference: '', provider: 'paynow', externalEventId: '', fraction: '1', providerAmount: '', providerCurrency: 'USD' })
  const [reversalMessage, setReversalMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load finance statistics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  const selectedExample = data?.policy.examples.find((item) => item.id === calcExampleId) || data?.policy.examples[0]
  const customerTotalForExample = selectedExample ? selectedExample.price * (1 + taxRate / 100) : 0
  const presetFee = selectedExample ? processorFeeFromPreset(customerTotalForExample, processorPresetId) : null
  const processorFee = manualProcessorFee == null ? (presetFee || 0) : manualProcessorFee
  const sellerPays = selectedExample?.commissionBps != null
    ? calculateMarketplaceEconomics({ productPrice: selectedExample.price, taxRatePercent: taxRate, commissionBps: selectedExample.commissionBps, processorFee, processorAllocatedToSeller: processorFee })
    : null
  const bvsAbsorbs = selectedExample?.commissionBps != null
    ? calculateMarketplaceEconomics({ productPrice: selectedExample.price, taxRatePercent: taxRate, commissionBps: selectedExample.commissionBps, processorFee, processorAllocatedToSeller: 0 })
    : null

  const processorMatrix = useMemo(() => {
    if (!data || !selectedExample || selectedExample.commissionBps == null) return []
    const charge = selectedExample.price * (1 + taxRate / 100)
    return data.policy.processorPresets.map((preset) => {
      const fee = processorFeeFromPreset(charge, preset.id)
      if (fee == null) return { ...preset, fee: null, sellerPays: null, bvsAbsorbs: null }
      return {
        ...preset,
        fee,
        sellerPays: calculateMarketplaceEconomics({ productPrice: selectedExample.price, taxRatePercent: taxRate, commissionBps: selectedExample.commissionBps!, processorFee: fee, processorAllocatedToSeller: fee }),
        bvsAbsorbs: calculateMarketplaceEconomics({ productPrice: selectedExample.price, taxRatePercent: taxRate, commissionBps: selectedExample.commissionBps!, processorFee: fee, processorAllocatedToSeller: 0 }),
      }
    })
  }, [data, selectedExample, taxRate])

  const authenticatedPost = useCallback(async (path: string, body: Record<string, unknown>) => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) throw new Error('Sign in again.')
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Finance action failed.')
    return payload
  }, [])

  const submitReconcile = useCallback(async () => {
    setReconcileMessage('')
    try {
      await authenticatedPost('/api/admin/editorial/finance/processor-fee', {
        reference: reconcile.reference,
        provider: reconcile.provider,
        amountOrderCurrency: Number(reconcile.fee),
        nativeAmount: reconcile.nativeAmount ? Number(reconcile.nativeAmount) : null,
        nativeCurrency: reconcile.nativeCurrency,
        status: reconcile.status,
      })
      setReconcileMessage('Processor fee reconciled; seller settlement and wallet entry refreshed.')
      await load()
    } catch (caught) { setReconcileMessage(caught instanceof Error ? caught.message : 'Could not reconcile processor fee.') }
  }, [authenticatedPost, load, reconcile])

  const submitReversal = useCallback(async () => {
    setReversalMessage('')
    try {
      await authenticatedPost('/api/admin/editorial/finance/reversal', {
        reference: reversal.reference,
        provider: reversal.provider,
        externalEventId: reversal.externalEventId,
        fraction: Number(reversal.fraction),
        providerAmount: reversal.providerAmount ? Number(reversal.providerAmount) : null,
        providerCurrency: reversal.providerCurrency,
      })
      setReversalMessage('Reversal recorded as an immutable creator-wallet debit.')
      await load()
    } catch (caught) { setReversalMessage(caught instanceof Error ? caught.message : 'Could not record reversal.') }
  }, [authenticatedPost, load, reversal])

  const quarterTarget = data ? targets.find((item) => item.quarter === data.period.quarter) : null

  return <main className="mx-auto max-w-7xl px-6 py-12">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><Link href="/editorial" className="text-sm text-brand hover:underline">← Editorial workflow</Link><p className="mt-5 text-xs uppercase tracking-[.22em] text-brand">Accounting & performance</p><h1 className="mt-2 text-4xl font-semibold">Editorial Finance</h1><p className="mt-3 max-w-3xl text-text-secondary">GMV, BVS revenue, tax liabilities, creator liabilities and processor costs stay separate. Incomplete data is never labelled profit.</p></div><button onClick={() => void load()} className="rounded-full border border-white/20 px-5 py-2 text-sm">Refresh live statistics</button></div>

    {loading && !data ? <div className="mt-8 animate-pulse rounded-2xl border border-white/10 p-10 text-text-secondary">Loading protected finance statistics…</div> : null}
    {error ? <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-red-200">{error}</div> : null}

    {data ? <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Paid artist subscribers" value={data.current.paidArtists ?? 'Not connected'} note={`${data.current.activeArtistMemberships ?? 0} active/trial artist memberships`} /><Metric label="Marketplace GMV this month" value={usd(data.current.monthMarketplaceGmv)} note={`${data.current.monthMarketplaceOrders} paid marketplace orders`} /><Metric label="Subscription MRR" value={usd(data.current.subscriptionMrr)} note="Monthly equivalent of provider-backed artist subscriptions" /><Metric label="Newsletter subscribers" value={data.current.newsletterSubscribers ?? 'Not connected'} note={data.availability.newsletter ? 'Active opt-ins' : 'Newsletter source not available'} warning={!data.availability.newsletter} /></section>

      <section className="mt-10 rounded-3xl border border-brand/25 bg-brand/[.045] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Marketplace Economics</p><h2 className="mt-2 text-3xl font-semibold">Protect BVS commission. Keep creator deductions transparent.</h2><p className="mt-3 max-w-4xl text-sm text-text-secondary">Policy {data.policy.version} · effective {new Date(data.policy.effectiveAt).toLocaleDateString()}. Marketplace processing is allocated to seller proceeds by default. BVS may subsidize it only through a deliberate, measured benefit.</p></div><span className="rounded-full border border-white/15 px-3 py-1 text-xs text-text-secondary">{data.canMutatePolicy ? 'Restricted finance controls enabled' : 'Read-only finance view'}</span></div>
        <div className="mt-6"><Flow steps={data.guidance.moneyFlow} /></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric label="BVS platform fees QTD" value={usd(data.accounting.bvsPlatformFees)} note="Commission on pre-tax product revenue" /><Metric label="Processor fees observed" value={usd(data.accounting.processorFees)} note="Actual or confirmed-schedule totals only" warning={!data.availability.processorFees} /><Metric label="Creator processing allocation" value={usd(data.accounting.sellerProcessorFees)} note="Separate from BVS commission" /><Metric label="BVS contribution after processing" value={usd(data.accounting.contributionAfterProcessor)} note="Before hosting, staff, marketing, refunds and company tax" /></div>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[850px] w-full text-sm"><thead className="bg-white/[.04] text-left text-xs uppercase tracking-[.08em] text-text-secondary"><tr><th className="p-4">Client / plan</th><th className="p-4">Subscription</th><th className="p-4">Sale type</th><th className="p-4">BVS fee</th><th className="p-4">Processing policy</th></tr></thead><tbody className="divide-y divide-white/10">{data.policy.feeTable.map((row) => <tr key={`${row.client}-${row.product}`}><td className="p-4 font-medium">{row.client}</td><td className="p-4 text-text-secondary">{row.subscription}</td><td className="p-4 text-text-secondary">{row.product}</td><td className="p-4 text-brand">{row.platformFee}</td><td className="p-4 text-text-secondary">{row.processing}</td></tr>)}</tbody></table></div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-5"><h3 className="text-xl font-semibold">Policy example calculator</h3><p className="mt-2 text-sm text-text-secondary">Select a product and processor. Estimates are labelled and never booked as real profit.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs text-text-secondary">Product / plan<select value={calcExampleId} onChange={(event) => { setCalcExampleId(event.target.value); setManualProcessorFee(null) }} className="mt-1 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary">{data.policy.examples.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs text-text-secondary">Processor<select value={processorPresetId} onChange={(event) => { setProcessorPresetId(event.target.value); setManualProcessorFee(null) }} className="mt-1 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary">{data.policy.processorPresets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs text-text-secondary">VAT / sales tax %<input value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value) || 0)} type="number" min="0" step="0.1" className="mt-1 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm" /></label><label className="text-xs text-text-secondary">Processor fee override (USD)<input value={manualProcessorFee ?? ''} onChange={(event) => setManualProcessorFee(event.target.value === '' ? null : Number(event.target.value))} type="number" min="0" step="0.01" placeholder={presetFee == null ? 'Not connected' : String(presetFee)} className="mt-1 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm" /></label></div>
            {selectedExample?.note ? <p className="mt-4 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">{selectedExample.note}</p> : null}
            {selectedExample?.revenueModel === 'future' || !sellerPays || !bvsAbsorbs ? <p className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/[.06] p-4 text-sm text-amber-100">No approved commercial rate exists for this future product. Finance must model fulfilment, shipping, returns and tax before launch.</p> : selectedExample.revenueModel === 'bvs_subscription' ? <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Subscription price" value={usd(bvsAbsorbs.productPrice)} /><Metric label="Tax payable" value={usd(bvsAbsorbs.tax)} note="Not BVS revenue" /><Metric label="Processor fee" value={usd(bvsAbsorbs.processorFee)} note="BVS cost on its own subscription" /><Metric label="BVS contribution" value={usd(bvsAbsorbs.bvsContributionAfterProcessing)} note="Before fixed OPEX" /></div> : <div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] p-4"><p className="text-xs uppercase tracking-[.1em] text-emerald-300">Default · creator pays processing</p><div className="mt-3 space-y-2 text-sm"><Line label="Product price" value={usd(sellerPays.productPrice)} /><Line label="Tax payable" value={usd(sellerPays.tax)} /><Line label="BVS fee" value={usd(sellerPays.commission)} /><Line label="Processing" value={usd(sellerPays.processorFee)} /><Line label="Creator earns" value={usd(sellerPays.sellerNet)} strong /><Line label="BVS contribution" value={usd(sellerPays.bvsContributionAfterProcessing)} strong /></div></div><div className="rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-4"><p className="text-xs uppercase tracking-[.1em] text-amber-200">Comparison · BVS absorbs processing</p><div className="mt-3 space-y-2 text-sm"><Line label="Product price" value={usd(bvsAbsorbs.productPrice)} /><Line label="Tax payable" value={usd(bvsAbsorbs.tax)} /><Line label="BVS fee" value={usd(bvsAbsorbs.commission)} /><Line label="Processing paid by BVS" value={usd(bvsAbsorbs.processorFee)} /><Line label="Creator earns" value={usd(bvsAbsorbs.sellerNet)} strong /><Line label="BVS contribution" value={usd(bvsAbsorbs.bvsContributionAfterProcessing)} strong /></div></div></div>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/15 p-5"><h3 className="text-xl font-semibold">Processor comparison</h3><p className="mt-2 text-sm text-text-secondary">For the selected product, compare the BVS position across Stripe / Paynow schedules. “Illustrative” is not booked profit.</p><div className="mt-4 overflow-x-auto"><table className="min-w-[620px] w-full text-xs"><thead className="text-left uppercase tracking-[.08em] text-text-secondary"><tr><th className="pb-3 pr-3">Processor</th><th className="pb-3 pr-3">Fee</th><th className="pb-3 pr-3">Creator net</th><th className="pb-3">BVS if absorbs</th></tr></thead><tbody>{processorMatrix.map((row) => <tr key={row.id} className="border-t border-white/10"><td className="py-3 pr-3"><div>{row.label}</div><div className="text-[10px] uppercase text-text-secondary">{row.status.replaceAll('_', ' ')}</div></td><td className="py-3 pr-3">{usd(row.fee)}</td><td className="py-3 pr-3 text-brand">{row.sellerPays ? usd(row.sellerPays.sellerNet) : 'N/A'}</td><td className={`py-3 ${row.bvsAbsorbs && row.bvsAbsorbs.bvsContributionAfterProcessing < 0 ? 'text-red-300' : ''}`}>{row.bvsAbsorbs ? usd(row.bvsAbsorbs.bvsContributionAfterProcessing) : 'N/A'}</td></tr>)}</tbody></table></div></div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3"><Metric label="Free → Plus break-even" value={usd(data.policy.producerBreakEven.freeToPlusMonthlyGmv)} note="Approx GMV where 7 points saved offsets $5/month" /><Metric label="Plus → Pro break-even" value={usd(data.policy.producerBreakEven.plusToProMonthlyGmv)} note="Approx GMV where 5 points saved offsets $10/month" /><Metric label="Creator Complete · later" value={`$${data.policy.creatorComplete.monthlyUsd}/mo · $${data.policy.creatorComplete.yearlyUsd}/yr`} note="Artist Standard + Producer Pro under $20/month" /></div>
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 p-6"><p className="text-xs uppercase tracking-[.18em] text-brand">BasJunior case study</p><h2 className="mt-2 text-2xl font-semibold">{data.caseStudy.reference}</h2><p className="mt-2 text-sm text-text-secondary">Historical learning case. The old ledger is not silently rewritten.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Customer paid" value={usd(data.caseStudy.knownHistorical.customerPaid)} /><Metric label="Product revenue" value={usd(data.caseStudy.knownHistorical.productPrice)} /><Metric label="VAT" value={usd(data.caseStudy.knownHistorical.vat)} /><Metric label="BVS fee @ 20%" value={usd(data.caseStudy.knownHistorical.bvsFee)} /><Metric label="Stripe fee" value={`€${data.caseStudy.knownHistorical.stripeFeeNative.toFixed(2)}`} note={`≈ ${usd(data.caseStudy.knownHistorical.stripeFeeApproxUsd)}`} /><Metric label="Correct creator net" value={usd(data.caseStudy.knownHistorical.correctSellerNetApproxUsd)} /></div>{data.caseStudy.legacyWarning ? <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[.07] p-4 text-sm text-amber-100">{data.caseStudy.legacyWarning}</div> : null}<p className="mt-3 text-xs text-text-secondary">{data.caseStudy.knownHistorical.sourceLabel}</p></section>

      <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Live sale breakdowns</p><h2 className="mt-2 text-2xl font-semibold">Settlement ledger</h2></div><p className="text-xs text-text-secondary">Actual, schedule, estimated and not-connected processor states remain distinct.</p></div><div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[1050px] w-full text-sm"><thead className="bg-white/[.04] text-left text-xs uppercase tracking-[.08em] text-text-secondary"><tr><th className="p-4">Order</th><th className="p-4">Plan</th><th className="p-4">Gross</th><th className="p-4">Tax</th><th className="p-4">BVS fee</th><th className="p-4">Processing</th><th className="p-4">Creator net</th><th className="p-4">State</th></tr></thead><tbody className="divide-y divide-white/10">{data.recentSettlements.length ? data.recentSettlements.map((row) => <tr key={String(row.id)}><td className="p-4">{String(row.order_reference || '')}<div className="text-xs text-text-secondary">{String(row.provider || '')}</div></td><td className="p-4 text-text-secondary">{String(row.seller_plan_id || 'free').replaceAll('_', ' ')}</td><td className="p-4">{usd(Number(row.gross_product_revenue || 0))}</td><td className="p-4">{row.order_tax_amount == null ? 'N/A' : usd(Number(row.order_tax_amount))}</td><td className="p-4">{usd(Number(row.platform_fee_amount || 0))}</td><td className="p-4">{usd(Number(row.processor_fee_allocated || 0))}<div className="text-[10px] uppercase text-text-secondary">{String(row.processor_fee_status || '').replaceAll('_', ' ')}</div></td><td className="p-4 font-semibold text-brand">{usd(Number(row.seller_net || 0))}</td><td className="p-4 capitalize">{String(row.settlement_status || '').replaceAll('_', ' ')}</td></tr>) : <tr><td className="p-5 text-text-secondary" colSpan={8}>No seller settlement rows yet. Run the marketplace economics SQL migration before activating the policy in production.</td></tr>}</tbody></table></div></section>

      {data.canMutatePolicy ? <section className="mt-10 grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><p className="text-xs uppercase tracking-[.18em] text-brand">Restricted control</p><h2 className="mt-2 text-xl font-semibold">Reconcile processor fee</h2><p className="mt-2 text-sm text-text-secondary">Use actual settlement data or a confirmed Paynow schedule. This converts a pending creator settlement to posted.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Input value={reconcile.reference} onChange={(value) => setReconcile((v) => ({ ...v, reference: value }))} placeholder="Order reference" /><select value={reconcile.provider} onChange={(e) => setReconcile((v) => ({ ...v, provider: e.target.value }))} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm"><option value="paynow">Paynow</option><option value="stripe">Stripe</option></select><Input value={reconcile.fee} onChange={(value) => setReconcile((v) => ({ ...v, fee: value }))} placeholder="Fee in order currency" type="number" /><Input value={reconcile.nativeAmount} onChange={(value) => setReconcile((v) => ({ ...v, nativeAmount: value }))} placeholder="Native fee (optional)" type="number" /><Input value={reconcile.nativeCurrency} onChange={(value) => setReconcile((v) => ({ ...v, nativeCurrency: value.toUpperCase() }))} placeholder="Native currency" /><select value={reconcile.status} onChange={(e) => setReconcile((v) => ({ ...v, status: e.target.value }))} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm"><option value="actual">Actual settlement</option><option value="schedule">Confirmed schedule</option></select></div><button onClick={() => void submitReconcile()} className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Reconcile fee</button>{reconcileMessage ? <p className="mt-3 text-sm text-text-secondary">{reconcileMessage}</p> : null}</div>
        <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><p className="text-xs uppercase tracking-[.18em] text-brand">Restricted control</p><h2 className="mt-2 text-xl font-semibold">Paynow / manual reversal</h2><p className="mt-2 text-sm text-text-secondary">Refunds do not edit old sale credits. They create an immutable debit tied to an external refund/reversal reference.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Input value={reversal.reference} onChange={(value) => setReversal((v) => ({ ...v, reference: value }))} placeholder="Order reference" /><select value={reversal.provider} onChange={(e) => setReversal((v) => ({ ...v, provider: e.target.value }))} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm"><option value="paynow">Paynow refund</option><option value="manual">Manual reversal</option></select><Input value={reversal.externalEventId} onChange={(value) => setReversal((v) => ({ ...v, externalEventId: value }))} placeholder="External refund/reference ID" /><Input value={reversal.fraction} onChange={(value) => setReversal((v) => ({ ...v, fraction: value }))} placeholder="Fraction 0–1" type="number" /><Input value={reversal.providerAmount} onChange={(value) => setReversal((v) => ({ ...v, providerAmount: value }))} placeholder="Refund amount (optional)" type="number" /><Input value={reversal.providerCurrency} onChange={(value) => setReversal((v) => ({ ...v, providerCurrency: value.toUpperCase() }))} placeholder="Currency" /></div><button onClick={() => void submitReversal()} className="mt-4 rounded-full border border-red-300/50 px-5 py-2 text-sm text-red-200">Record reversal</button>{reversalMessage ? <p className="mt-3 text-sm text-text-secondary">{reversalMessage}</p> : null}</div></section> : null}

      <section className="mt-10 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 p-6"><p className="text-xs uppercase tracking-[.18em] text-brand">Quarterly goal</p><h2 className="mt-2 text-2xl font-semibold">{data.period.quarter}</h2><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Paid artists target" value={quarterTarget?.artists ?? 'Baseline'} /><Metric label="Monthly GMV target" value={quarterTarget?.gmv == null ? 'Baseline' : usd(quarterTarget.gmv)} /><Metric label="Newsletter target" value={quarterTarget?.newsletter ?? 'Baseline'} /></div><p className="mt-4 text-sm text-text-secondary">{quarterTarget?.outcome}</p></div><div className="rounded-2xl border border-white/10 p-6"><p className="text-xs uppercase tracking-[.18em] text-brand">Tax & payout guidance</p><ul className="mt-4 space-y-3 text-sm text-text-secondary">{data.guidance.tax.map((line) => <li key={line}>• {line}</li>)}</ul></div></section>

      <section className="mt-10"><p className="text-xs uppercase tracking-[.18em] text-brand">Quarter-to-date accounting</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Customer receipts" value={usd(data.accounting.quarterCheckout)} note="Includes tax" /><Metric label="Pre-tax GMV" value={usd(data.accounting.quarterGmv)} note="Not automatically BVS revenue" /><Metric label="Tax collected" value={usd(data.accounting.quarterTax)} note="Liability, not profit" /><Metric label="Wallet liability" value={usd(data.accounting.walletLiability)} /><Metric label="Posted creator sale credits" value={usd(data.accounting.quarterArtistSaleCredits)} /><Metric label="Pending creator earnings" value={usd(data.accounting.pendingArtistSaleCredits)} warning={Boolean(data.accounting.pendingArtistSaleCredits)} /><Metric label="Refund / reversal debits" value={usd(data.accounting.quarterRefundDebits)} /><Metric label="Gross profit / free cash flow" value="Not calculated" note="Requires complete OPEX and company-tax data" warning /></div></section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 p-6"><h2 className="text-xl font-semibold">Payment controls</h2><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Paid orders" value={data.controls.paidOrders} /><Metric label="Verified events" value={data.controls.verifiedPaymentEvents ?? 'Not connected'} /><Metric label="Unresolved events" value={data.controls.unresolvedPaymentEvents ?? 'Not connected'} warning={Boolean(data.controls.unresolvedPaymentEvents)} /><Metric label="Pending fee settlements" value={data.controls.pendingProcessorSettlements ?? 'Not connected'} warning={Boolean(data.controls.pendingProcessorSettlements)} /><Metric label="Refund / reversal events" value={data.controls.refundEvents ?? 'Not connected'} /></div></div><div className="rounded-2xl border border-white/10 p-6"><h2 className="text-xl font-semibold">Policy audit</h2>{data.policy.audit.length ? <div className="mt-4 space-y-3">{data.policy.audit.slice(0, 8).map((row) => <div key={String(row.id)} className="rounded-xl border border-white/10 p-3 text-sm"><div className="font-medium">{String(row.action || '').replaceAll('_', ' ')}</div><div className="mt-1 text-xs text-text-secondary">{String(row.policy_version || '')} · {row.created_at ? new Date(String(row.created_at)).toLocaleString() : ''}</div></div>)}</div> : <p className="mt-4 text-sm text-text-secondary">Policy audit will appear after the marketplace economics migration is installed.</p>}</div></section>

      <div className="mt-10 rounded-2xl border border-brand/25 bg-brand/[.06] p-5 text-sm"><strong>Core rule:</strong> BVS makes more when creators make more, but no paid tier should force BVS to lose money on a sale. Tax is never commissionable, processing is transparent, and historical economics are snapshotted when the order is created.</div>
    </> : null}
  </main>
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? 'border-t border-white/10 pt-2 font-semibold' : 'text-text-secondary'}`}><span>{label}</span><span className={strong ? 'text-brand' : 'text-text-primary'}>{value}</span></div>
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm" />
}
