'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { validatePayoutRequest } from '@/lib/artist-payouts'

type Settlement = {
  id: string
  order_reference: string
  provider: string
  policy_version: string
  seller_plan_id?: string | null
  gross_product_revenue: number | string
  platform_fee_bps: number | string
  platform_fee_amount: number | string
  processor_fee_allocated: number | string
  processor_fee_status: string
  processor_fee_native_amount?: number | string | null
  processor_fee_native_currency?: string | null
  seller_net: number | string
  refunds?: number | string
  payout_net?: number | string
  tax_excluded?: boolean
  settlement_status: string
  breakdown?: { lines?: Array<{ title?: string; productType?: string; gross?: number; platformFee?: number; commissionBps?: number }> }
  created_at: string
}

type WalletData = {
  profile: { username?: string; display_name?: string; role?: string; is_verified?: boolean; is_published?: boolean } | null
  waitlist: { artist_name: string; status: string; created_at: string } | null
  deposits: Array<{ id: string; amount: number | string; currency: string; status: string; source: string; created_at: string }>
  ledger: Array<{ id: string; direction: string; entry_type: string; amount: number | string; currency: string; status: string; memo?: string; effective_at: string; metadata?: Record<string, unknown> }>
  payoutMethods: Array<{ id: string; label: string; method_type: string; currency: string; status: string; is_default?: boolean }>
  payoutRequests: Array<{ id: string; requested_amount: number | string; currency: string; status: string; requested_at: string }>
  sellerSettlements: Settlement[]
  settings: { payoutMinimumUsd: number; currency: string }
  balances: { available: number; pendingDeposits: number; pendingEarnings: number }
  earnings: {
    lifetimeGrossSales: number
    bvsPlatformFees: number
    processorFees: number
    refundDebits: number
    postedNetEarnings: number
    netAfterRefunds: number
    pendingNetEarnings: number
    settlementCount: number
  }
  sources: { marketplaceEarnings: number; radioEarnings: number; foundingBonus: number; otherCreditsAndAdjustments: number }
  radio: { eligiblePlays: number; fundedEarnings: number; settlementStatus: string }
}

const emptyData: WalletData = {
  profile: null,
  waitlist: null,
  deposits: [],
  ledger: [],
  payoutMethods: [],
  payoutRequests: [],
  sellerSettlements: [],
  settings: { payoutMinimumUsd: 25, currency: 'USD' },
  balances: { available: 0, pendingDeposits: 0, pendingEarnings: 0 },
  earnings: { lifetimeGrossSales: 0, bvsPlatformFees: 0, processorFees: 0, refundDebits: 0, postedNetEarnings: 0, netAfterRefunds: 0, pendingNetEarnings: 0, settlementCount: 0 },
  sources: { marketplaceEarnings: 0, radioEarnings: 0, foundingBonus: 0, otherCreditsAndAdjustments: 0 },
  radio: { eligiblePlays: 0, fundedEarnings: 0, settlementStatus: 'awaiting_funded_programme' },
}

function money(amount: number | string, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0)
}

function pctFromBps(value: number | string) {
  return `${((Number(value) || 0) / 100).toFixed(1)}%`
}

export default function ArtistsPage() {
  const configured = isSupabaseConfigured()
  const [token, setToken] = useState('')
  const [data, setData] = useState<WalletData>(emptyData)
  const [loading, setLoading] = useState(configured)
  const [error, setError] = useState('')
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethodId, setPayoutMethodId] = useState('')
  const [payoutNote, setPayoutNote] = useState('')
  const [payoutBusy, setPayoutBusy] = useState(false)
  const [payoutMessage, setPayoutMessage] = useState('')

  const load = async (accessToken: string) => {
    const response = await fetch('/api/artist/wallet', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Could not load artist wallet.')
    setData({ ...emptyData, ...payload, balances: { ...emptyData.balances, ...(payload.balances || {}) }, earnings: { ...emptyData.earnings, ...(payload.earnings || {}) }, sources: { ...emptyData.sources, ...(payload.sources || {}) }, radio: { ...emptyData.radio, ...(payload.radio || {}) }, sellerSettlements: payload.sellerSettlements || [] })
  }

  useEffect(() => {
    if (!configured) return
    createClient().auth.getSession().then(async ({ data: sessionData }) => {
      const accessToken = sessionData.session?.access_token
      if (!accessToken) { setLoading(false); return }
      setToken(accessToken)
      try { await load(accessToken) }
      catch (caught) { setError(caught instanceof Error ? caught.message : 'Artist wallet is not ready.') }
      finally { setLoading(false) }
    })
  }, [configured])

  const nextPayout = useMemo(() => Math.max(0, data.settings.payoutMinimumUsd - data.balances.available), [data])
  const hasCommerce = data.sellerSettlements.length > 0 || data.earnings.lifetimeGrossSales > 0 || data.balances.pendingEarnings > 0
  const hasOpenPayout = data.payoutRequests.some((request) => ['requested', 'approved', 'processing'].includes(request.status))

  const requestPayout = async () => {
    setError('')
    setPayoutMessage('')
    const validation = validatePayoutRequest({
      available: data.balances.available,
      minimum: data.settings.payoutMinimumUsd,
      requested: payoutAmount === '' ? null : Number(payoutAmount),
      hasOpenRequest: hasOpenPayout,
    })
    if (!validation.ok) { setError(validation.message); return }
    setPayoutBusy(true)
    try {
      const response = await fetch('/api/artist/wallet/payout-request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: validation.amount, payoutMethodId: payoutMethodId || null, note: payoutNote }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not request payout.')
      setPayoutMessage('Payout request submitted. BVS will review the destination and processing details.')
      setPayoutAmount('')
      setPayoutNote('')
      await load(token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not request payout.')
    } finally {
      setPayoutBusy(false)
    }
  }

  if (!configured) return <AccessNotice title="Artist access unavailable" text="Account service is not configured." />
  if (loading) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Loading artist wallet...</main>
  if (!token) return <AccessNotice title="Artist login required" text="Sign in or create a free artist account to view earnings and payout activity." />

  return <main className="mx-auto max-w-7xl px-6 py-12">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs uppercase tracking-[0.22em] text-brand">Studio · Artist access</p><h1 className="mt-2 text-4xl font-semibold">Wallet & earnings</h1><p className="mt-3 max-w-3xl text-text-secondary">See what you sold, what BVS earned, payment processing, refunds, and the amount that actually remains for payout.</p></div><div className="flex flex-wrap gap-2"><Link href="/creator/studio#artist-access" className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Back to Studio</Link><Link href="/upload" className="rounded-full border border-white/20 px-5 py-2 text-sm hover:border-brand">Submit music / beats</Link><Link href="/premium" className="rounded-full border border-brand/40 px-5 py-2 text-sm text-brand hover:bg-brand/10">Compare Premium</Link></div></div>

    {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}

    <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Available balance" value={money(data.balances.available)} note="Posted credits minus posted debits" /><Metric label="Pending earnings" value={money(data.balances.pendingEarnings)} note="Waiting for processor reconciliation" warning={data.balances.pendingEarnings > 0} /><Metric label="Lifetime product sales" value={money(data.earnings.lifetimeGrossSales)} note="Pre-tax GMV attributed to you" /><Metric label="BVS platform fees" value={money(data.earnings.bvsPlatformFees)} note="Commission on pre-tax price" /><Metric label="Processing deducted" value={money(data.earnings.processorFees)} note="Actual/schedule allocation" /><Metric label="Refunds / reversals" value={money(data.earnings.refundDebits)} note={`Net earned after reversals: ${money(data.earnings.netAfterRefunds)}`} warning={data.earnings.refundDebits > 0} /></section>

    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-6"><div><p className="text-xs uppercase tracking-[.16em] text-brand">Balance by source</p><h2 className="mt-1 text-2xl font-semibold">Where your posted balance came from</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Marketplace earnings" value={money(data.sources.marketplaceEarnings)} note="Posted sales and licences" /><Metric label="BVS Radio earnings" value={money(data.sources.radioEarnings)} note="Funded radio programme credits" /><Metric label="Founding Artist Bonus" value={money(data.sources.foundingBonus)} note="One-time early catalogue reward" /><Metric label="Other adjustments" value={money(data.sources.otherCreditsAndAdjustments)} note="Deposits, manual credits and debits" warning={data.sources.otherCreditsAndAdjustments < 0} /></div></section>

    <section className="mt-8 rounded-2xl border border-brand/25 bg-brand/[.05] p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs uppercase tracking-[.16em] text-brand">BVS Radio activity</p><h2 className="mt-1 text-2xl font-semibold">Your radio performance</h2><p className="mt-2 max-w-2xl text-sm text-text-secondary">Eligible plays show audience activity. Radio earnings appear only after a funded programme settlement is posted.</p></div><span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs capitalize text-text-secondary">{data.radio.settlementStatus.replaceAll('_', ' ')}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Eligible plays" value={new Intl.NumberFormat('en-US').format(data.radio.eligiblePlays)} note="Approved public catalogue tracks" /><Metric label="Funded radio earnings" value={money(data.radio.fundedEarnings)} note="Posted programme settlements" /></div><p className="mt-4 text-xs text-text-secondary">Early artists may receive a separate one-time Founding Artist Bonus. Future BVS Radio earnings depend on eligible plays and funded programme revenue.</p></section>

    {hasCommerce ? <section className="mt-8 rounded-2xl border border-brand/25 bg-brand/[.05] p-5"><h2 className="text-xl font-semibold">How a marketplace sale reaches your wallet</h2><div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><FlowStep text="Pre-tax product sale" /><Arrow /><FlowStep text="BVS platform fee" /><Arrow /><FlowStep text="Payment processing" /><Arrow /><FlowStep text="Your earnings" /><Arrow /><FlowStep text="Refund/reversal adjustments" /><Arrow /><FlowStep text="Available for payout" /></div><p className="mt-4 text-sm text-text-secondary">VAT/sales tax is outside the split. BVS commission is never calculated on customer tax. Unknown processing keeps a sale pending instead of pretending an estimated fee is final.</p></section> : null}

    <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.025] p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.16em] text-brand">Sale statements</p><h2 className="mt-1 text-2xl font-semibold">Marketplace earnings</h2></div><p className="text-xs text-text-secondary">Gross below is pre-tax. The policy and economics are frozen at checkout.</p></div>{data.sellerSettlements.length ? <div className="mt-5 overflow-x-auto"><table className="min-w-[1080px] w-full text-left text-sm"><thead className="text-xs uppercase tracking-[.08em] text-text-secondary"><tr><th className="pb-3 pr-4">Sale</th><th className="pb-3 pr-4">Plan</th><th className="pb-3 pr-4">Gross ex-tax</th><th className="pb-3 pr-4">BVS fee</th><th className="pb-3 pr-4">Processing</th><th className="pb-3 pr-4">Initial net</th><th className="pb-3 pr-4">Refunds</th><th className="pb-3 pr-4">Payout net</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Policy</th></tr></thead><tbody>{data.sellerSettlements.map((settlement) => { const firstLine = settlement.breakdown?.lines?.[0]; return <tr key={settlement.id} className="border-t border-white/10"><td className="py-4 pr-4"><div className="font-medium">{firstLine?.title || settlement.order_reference}</div><div className="text-xs text-text-secondary">{settlement.order_reference} · {settlement.provider}</div></td><td className="py-4 pr-4 text-text-secondary">{(settlement.seller_plan_id || 'free').replaceAll('_', ' ')}</td><td className="py-4 pr-4">{money(settlement.gross_product_revenue)}</td><td className="py-4 pr-4">{money(settlement.platform_fee_amount)}<div className="text-xs text-text-secondary">{pctFromBps(settlement.platform_fee_bps)}</div></td><td className="py-4 pr-4">{money(settlement.processor_fee_allocated)}<div className="text-xs capitalize text-text-secondary">{settlement.processor_fee_status.replaceAll('_', ' ')}</div></td><td className="py-4 pr-4">{money(settlement.seller_net)}</td><td className="py-4 pr-4 text-amber-200">{money(settlement.refunds || 0)}</td><td className="py-4 pr-4 font-semibold text-brand">{money(settlement.payout_net ?? settlement.seller_net)}</td><td className={`py-4 pr-4 capitalize ${settlement.settlement_status === 'posted' ? 'text-emerald-300' : settlement.settlement_status === 'reversed' ? 'text-red-300' : 'text-amber-200'}`}>{settlement.settlement_status.replaceAll('_', ' ')}</td><td className="py-4 text-xs text-text-secondary">{settlement.policy_version}</td></tr> })}</tbody></table></div> : <p className="mt-5 rounded-xl border border-dashed border-white/15 p-6 text-sm text-text-secondary">No marketplace sale statements yet. Once a verified sale is attributed to you, its BVS fee, processing, refund adjustments and payout net appear here.</p>}</section>

    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
      <h2 className="text-2xl font-semibold">Payout readiness</h2>
      <p className="mt-2 text-sm text-text-secondary">{hasOpenPayout ? 'A payout request is already in progress.' : nextPayout > 0 ? `${money(nextPayout)} more in posted balance is needed before payout requests open.` : 'Posted balance is above the current payout threshold.'}</p>
      <p className="mt-3 text-xs text-text-secondary">Funded posted credits from eligible sources combine toward the payout threshold. Pending settlements do not count. Refunds and chargebacks remain visible as separate debits.</p>
      {nextPayout === 0 && !hasOpenPayout ? <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm">Amount (USD)<input type="number" min={data.settings.payoutMinimumUsd} max={data.balances.available} step="0.01" value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} placeholder={data.balances.available.toFixed(2)} className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3" /></label>
        <label className="text-sm">Payout method<select value={payoutMethodId} onChange={(event) => setPayoutMethodId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3"><option value="">Confirm manually with BVS</option>{data.payoutMethods.filter((method) => method.status === 'active').map((method) => <option key={method.id} value={method.id}>{method.label} · {method.method_type.replaceAll('_', ' ')}</option>)}</select></label>
        <label className="text-sm md:col-span-2">Note (optional)<textarea value={payoutNote} onChange={(event) => setPayoutNote(event.target.value.slice(0, 500))} rows={3} className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3" placeholder="Reference or payout note" /></label>
        <div className="md:col-span-2"><button type="button" disabled={payoutBusy} onClick={requestPayout} className="rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-50">{payoutBusy ? 'Submitting…' : 'Request payout'}</button>{payoutMessage ? <p className="mt-3 text-sm text-emerald-300">{payoutMessage}</p> : null}</div>
      </div> : null}
      {data.payoutRequests.length ? <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase text-text-secondary"><tr><th className="pb-3">Requested</th><th className="pb-3">Amount</th><th className="pb-3">Status</th></tr></thead><tbody>{data.payoutRequests.map((request) => <tr key={request.id} className="border-t border-white/10"><td className="py-3">{new Date(request.requested_at).toLocaleDateString()}</td><td className="py-3">{money(request.requested_amount, request.currency)}</td><td className="py-3 capitalize text-text-secondary">{request.status}</td></tr>)}</tbody></table></div> : null}
    </section>

    <section className="mt-12 grid gap-8 lg:grid-cols-2"><ActivityTable title="Wallet ledger" rows={data.ledger.map((entry) => [ledgerLabel(entry), entry.status, `${entry.direction === 'debit' ? '−' : '+'}${money(entry.amount, entry.currency)}`, new Date(entry.effective_at).toLocaleDateString()])} empty="No wallet entries yet." /><ActivityTable title="Deposits" rows={data.deposits.map((deposit) => [deposit.source, deposit.status, money(deposit.amount, deposit.currency), new Date(deposit.created_at).toLocaleDateString()])} empty="No deposits yet." /></section>
  </main>
}

function AccessNotice({ title, text }: { title: string; text: string }) { return <main className="mx-auto min-h-[65vh] max-w-2xl px-6 py-20 text-center"><h1 className="text-3xl">{title}</h1><p className="mt-4 text-text-secondary">{text}</p><div className="mt-7 flex justify-center gap-3"><Link href="/auth/login" className="rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link><Link href="/auth/signup" className="rounded-full border border-white/20 px-6 py-3">Create account</Link></div></main> }
function Metric({ label, value, note, warning = false }: { label: string; value: string; note?: string; warning?: boolean }) { return <div className={`rounded-2xl border p-5 ${warning ? 'border-amber-400/30 bg-amber-400/[.06]' : 'border-white/10 bg-white/[0.03]'}`}><p className="text-sm text-text-secondary">{label}</p><p className={`mt-2 text-2xl font-semibold capitalize ${warning ? 'text-amber-200' : 'text-brand'}`}>{value}</p>{note ? <p className="mt-2 text-xs text-text-secondary">{note}</p> : null}</div> }
function FlowStep({ text }: { text: string }) { return <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{text}</span> }
function Arrow() { return <span className="font-semibold text-brand">→</span> }
function ledgerLabel(entry: WalletData['ledger'][number]) {
  if (entry.entry_type === 'royalty_credit') return 'BVS Radio earnings'
  if (['founding_artist_bonus', 'promotional_credit'].includes(entry.entry_type) || (entry.entry_type === 'manual_credit' && entry.metadata?.program === 'founding_artist_bonus')) return 'Founding Artist Bonus'
  if (entry.entry_type === 'sale_credit') return 'Marketplace earnings'
  return entry.memo || entry.entry_type.replaceAll('_', ' ')
}
function ActivityTable({ title, rows, empty }: { title: string; rows: string[][]; empty: string }) { return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><h2 className="text-2xl font-semibold">{title}</h2>{rows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><tbody>{rows.map((row, index) => <tr key={`${row.join('-')}-${index}`} className="border-t border-white/10 first:border-t-0">{row.map((cell, cellIndex) => <td key={cellIndex} className={`py-3 pr-3 ${cellIndex === 0 ? 'capitalize' : 'text-text-secondary'}`}>{cell}</td>)}</tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-text-secondary">{empty}</p>}</section> }
