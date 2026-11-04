'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { writeCartLines } from '@/lib/cart-client'

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
  earningsBySource?: Array<{ source: string; amount: number }>
  radio: {
    eligiblePlays: number
    qualifiedStreams: number
    theoreticalCapUsd: number
    fundedEarnings: number
    settlementStatus: string
    policy?: {
      qualifiedStreamSeconds: number
      settlementCadence: string
      maximumUsdPerEligiblePlay: number
      listenAdPotEnabled: boolean
    }
  }
}

const emptyData: WalletData = {
  profile: null,
  waitlist: null,
  deposits: [],
  ledger: [],
  payoutRequests: [],
  sellerSettlements: [],
  settings: { payoutMinimumUsd: 25, currency: 'USD' },
  balances: { available: 0, pendingDeposits: 0, pendingEarnings: 0 },
  earnings: { lifetimeGrossSales: 0, bvsPlatformFees: 0, processorFees: 0, refundDebits: 0, postedNetEarnings: 0, netAfterRefunds: 0, pendingNetEarnings: 0, settlementCount: 0 },
  sources: { marketplaceEarnings: 0, radioEarnings: 0, foundingBonus: 0, otherCreditsAndAdjustments: 0 },
  radio: { eligiblePlays: 0, qualifiedStreams: 0, theoreticalCapUsd: 0, fundedEarnings: 0, settlementStatus: 'awaiting_funded_programme' },
}

function money(amount: number | string, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0)
}

function pctFromBps(value: number | string) {
  return `${((Number(value) || 0) / 100).toFixed(1)}%`
}

export default function ArtistsPage() {
  const configured = isSupabaseConfigured()
  const router = useRouter()
  const [token, setToken] = useState('')
  const [data, setData] = useState<WalletData>(emptyData)
  const [form, setForm] = useState({ artistName: '', contactName: '', country: '', city: '', instagram: '', spotify: '', website: '', notes: '' })
  const [loading, setLoading] = useState(configured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [earningsMonths, setEarningsMonths] = useState(12)

  const load = async (accessToken: string) => {
    const response = await fetch('/api/artist/wallet', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Could not load artist wallet.')
    setData({ ...emptyData, ...payload, balances: { ...emptyData.balances, ...(payload.balances || {}) }, earnings: { ...emptyData.earnings, ...(payload.earnings || {}) }, sources: { ...emptyData.sources, ...(payload.sources || {}) }, radio: { ...emptyData.radio, ...(payload.radio || {}) }, sellerSettlements: payload.sellerSettlements || [] })
    setForm((current) => ({ ...current, artistName: current.artistName || payload.waitlist?.artist_name || payload.profile?.display_name || payload.profile?.username || '' }))
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
  const earningsSourceLabels: Record<string, string> = { single_sales: 'Music & single sales', beat_sales: 'Beat sales', studio_products: 'Studio products', studio_services: 'Studio services', streams: 'BVS Radio streams', other: 'Other credits' }
  const sourceCards = (data.earningsBySource || []).filter((entry) => entry.amount > 0).sort((a, b) => b.amount - a.amount)
  const sourceTotal = sourceCards.reduce((sum, entry) => sum + entry.amount, 0)
  const monthlyEarnings = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: earningsMonths }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (earningsMonths - 1 - index), 1))
      return { key: date.toISOString().slice(0, 7), label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }), amount: 0 }
    })
    const byMonth = new Map(months.map((month) => [month.key, month]))
    data.ledger.filter((entry) => entry.direction === 'credit' && entry.status === 'posted').forEach((entry) => {
      const month = byMonth.get(String(entry.effective_at).slice(0, 7))
      if (month) month.amount += Number(entry.amount) || 0
    })
    return months
  }, [data.ledger, earningsMonths])
  const maxMonthlyEarnings = Math.max(1, ...monthlyEarnings.map((month) => month.amount))

  const submitWaitlist = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/artist/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save queue entry.')
      await load(token)
      setMessage('Artist queue entry saved.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save queue entry.') }
    finally { setSaving(false) }
  }

  const reserveDeposit = (amount: number) => {
    writeCartLines([{ id: `artist-priority-deposit-${amount}`, title: 'Artist priority deposit', artist: form.artistName || data.profile?.display_name || 'BVS artist', type: 'artist_deposit', price: amount, quantity: 1, delivery: 'Creditable BVS artist platform balance. Does not guarantee airplay or publication.' }])
    router.push('/checkout')
  }

  if (!configured) return <AccessNotice title="Artist access unavailable" text="Account service is not configured." />
  if (loading) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Loading artist wallet...</main>
  if (!token) return <AccessNotice title="Artist login required" text="Sign in or create a free artist account to join the priority queue and track credits." />

  return <main className="mx-auto max-w-7xl px-6 py-12">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs uppercase tracking-[0.22em] text-brand">Studio · Artist access</p><h1 className="mt-2 text-4xl font-semibold">Wallet & earnings</h1><p className="mt-3 max-w-3xl text-text-secondary">See what you sold, what BVS earned, payment processing, refunds, and the amount that actually remains for payout.</p></div><div className="flex flex-wrap gap-2"><Link href="/creator/studio#artist-access" className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Back to Studio</Link><Link href="/upload" className="rounded-full border border-white/20 px-5 py-2 text-sm hover:border-brand">Submit music / beats</Link><Link href="/premium" className="rounded-full border border-brand/40 px-5 py-2 text-sm text-brand hover:bg-brand/10">Compare Premium</Link></div></div>

    {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
    {message && <p className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-brand">{message}</p>}

    <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Available balance" value={money(data.balances.available)} note="Posted credits minus posted debits" /><Metric label="Pending earnings" value={money(data.balances.pendingEarnings)} note="Waiting for processor reconciliation" warning={data.balances.pendingEarnings > 0} /><Metric label="Lifetime product sales" value={money(data.earnings.lifetimeGrossSales)} note="Pre-tax GMV attributed to you" /><Metric label="BVS platform fees" value={money(data.earnings.bvsPlatformFees)} note="Commission on pre-tax price" /><Metric label="Processing deducted" value={money(data.earnings.processorFees)} note="Actual/schedule allocation" /><Metric label="Refunds / reversals" value={money(data.earnings.refundDebits)} note={`Net earned after reversals: ${money(data.earnings.netAfterRefunds)}`} warning={data.earnings.refundDebits > 0} /></section>

    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[.16em] text-brand">Earnings analytics</p><h2 className="mt-1 text-2xl font-semibold">Your BVS earnings</h2><p className="mt-2 text-sm text-text-secondary">Posted credits by month. Marketplace sales and funded BVS Radio credits are shown together, with no royalty estimates.</p></div>
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="sr-only" htmlFor="earnings-view">Earnings view</label><select id="earnings-view" className="min-h-10 border border-white/15 bg-bg-primary px-3" defaultValue="bvs"><option value="bvs">View by BVS source</option></select>
          <label className="sr-only" htmlFor="earnings-range">Earnings period</label><select id="earnings-range" className="min-h-10 border border-white/15 bg-bg-primary px-3" value={earningsMonths} onChange={(event) => setEarningsMonths(Number(event.target.value))}><option value={12}>Last 12 months</option><option value={6}>Last 6 months</option><option value={3}>Last 3 months</option></select>
        </div>
      </div>
      <div className="bvs-wallet-monthly-chart mt-6">
        <div className="flex items-center justify-between text-xs text-text-secondary"><span>USD</span><span>{money(monthlyEarnings.reduce((sum, month) => sum + month.amount, 0))} in period</span></div>
        <div className="bvs-wallet-monthly-bars" style={{ gridTemplateColumns: `repeat(${earningsMonths}, minmax(0, 1fr))` }} role="img" aria-label={`Posted BVS earnings over the last ${earningsMonths} months`}>
          {monthlyEarnings.map((month) => <div key={month.key} className="bvs-wallet-month"><span className="bvs-wallet-month-value">{month.amount ? money(month.amount) : ''}</span><div className="bvs-wallet-month-bar" style={{ height: `${Math.max(month.amount ? 8 : 2, month.amount / maxMonthlyEarnings * 100)}%` }} /><span className="bvs-wallet-month-label">{month.label}</span></div>)}
        </div>
        <p className="mt-4 text-xs text-text-secondary">Only posted credits are plotted. Pending sales and uncredited listening activity stay separate until confirmed in the ledger.</p>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(sourceCards.length ? sourceCards : [{ source: 'single_sales', amount: 0 }]).map((entry) => <div key={entry.source} className="bvs-wallet-source-card"><div className="flex items-center justify-between gap-2"><span className="text-xs text-text-secondary">{earningsSourceLabels[entry.source] || entry.source}</span><span className="text-xs text-text-secondary">{sourceTotal ? `${Math.round(entry.amount / sourceTotal * 100)}%` : '0%'}</span></div><strong>{money(entry.amount)}</strong></div>)}
      </div>
    </section>

    <section className="bvs-wallet-radio mt-8 rounded-2xl border border-brand/25 bg-brand/[.05] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.16em] text-brand">BVS Radio</p><h2 className="mt-1 text-xl font-semibold">Activity & credited cash</h2></div><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs capitalize text-text-secondary">{String(data.radio.settlementStatus || '').replaceAll('_', ' ')}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Metric compact label="Eligible plays" value={new Intl.NumberFormat('en-US').format(data.radio.eligiblePlays || 0)} note="Approved catalogue plays" /><Metric compact label="Qualified listens" value={new Intl.NumberFormat('en-US').format(data.radio.qualifiedStreams || 0)} note={`${data.radio.policy?.qualifiedStreamSeconds || 30}s+ listens`} /><Metric compact label="Credited earnings" value={money(data.radio.fundedEarnings || 0)} note="Posted programme credits" /><Metric compact label="Policy ceiling" value={money(data.radio.theoreticalCapUsd || 0)} note="Illustrative, not expected income" /></div><p className="mt-3 text-xs text-text-secondary">Activity becomes wallet cash only after a funded monthly programme is settled and posted.</p></section>

    {hasCommerce ? <section className="mt-8 rounded-2xl border border-brand/25 bg-brand/[.05] p-5"><h2 className="text-xl font-semibold">How a marketplace sale reaches your wallet</h2><div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><FlowStep text="Pre-tax product sale" /><Arrow /><FlowStep text="BVS platform fee" /><Arrow /><FlowStep text="Payment processing" /><Arrow /><FlowStep text="Your earnings" /><Arrow /><FlowStep text="Refund/reversal adjustments" /><Arrow /><FlowStep text="Available for payout" /></div><p className="mt-4 text-sm text-text-secondary">VAT/sales tax is outside the split. BVS commission is never calculated on customer tax. Unknown processing keeps a sale pending instead of pretending an estimated fee is final.</p></section> : null}

    <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.025] p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.16em] text-brand">Earnings records</p><h2 className="mt-1 text-2xl font-semibold">Marketplace sale statements</h2></div><p className="max-w-md text-xs text-text-secondary">Gross is pre-tax. Each verified sale keeps its checkout policy, BVS fee, processing, refunds, and payout net together.</p></div>{data.sellerSettlements.length ? <div className="mt-5 overflow-x-auto"><table className="min-w-[1080px] w-full text-left text-sm"><thead className="text-xs uppercase tracking-[.08em] text-text-secondary"><tr><th className="pb-3 pr-4">Sale</th><th className="pb-3 pr-4">Plan</th><th className="pb-3 pr-4">Gross ex-tax</th><th className="pb-3 pr-4">BVS fee</th><th className="pb-3 pr-4">Processing</th><th className="pb-3 pr-4">Initial net</th><th className="pb-3 pr-4">Refunds</th><th className="pb-3 pr-4">Payout net</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Policy</th></tr></thead><tbody>{data.sellerSettlements.map((settlement) => { const firstLine = settlement.breakdown?.lines?.[0]; return <tr key={settlement.id} className="border-t border-white/10"><td className="py-4 pr-4"><div className="font-medium">{firstLine?.title || settlement.order_reference}</div><div className="text-xs text-text-secondary">{settlement.order_reference} · {settlement.provider}</div></td><td className="py-4 pr-4 text-text-secondary">{(settlement.seller_plan_id || 'free').replaceAll('_', ' ')}</td><td className="py-4 pr-4">{money(settlement.gross_product_revenue)}</td><td className="py-4 pr-4">{money(settlement.platform_fee_amount)}<div className="text-xs text-text-secondary">{pctFromBps(settlement.platform_fee_bps)}</div></td><td className="py-4 pr-4">{money(settlement.processor_fee_allocated)}<div className="text-xs capitalize text-text-secondary">{settlement.processor_fee_status.replaceAll('_', ' ')}</div></td><td className="py-4 pr-4">{money(settlement.seller_net)}</td><td className="py-4 pr-4 text-amber-200">{money(settlement.refunds || 0)}</td><td className="py-4 pr-4 font-semibold text-brand">{money(settlement.payout_net ?? settlement.seller_net)}</td><td className={`py-4 pr-4 capitalize ${settlement.settlement_status === 'posted' ? 'text-emerald-300' : settlement.settlement_status === 'reversed' ? 'text-red-300' : 'text-amber-200'}`}>{settlement.settlement_status.replaceAll('_', ' ')}</td><td className="py-4 text-xs text-text-secondary">{settlement.policy_version}</td></tr> })}</tbody></table></div> : <div className="bvs-wallet-empty mt-5"><div className="bvs-wallet-empty-icon">$</div><div><h3 className="font-semibold text-white">No marketplace sales yet</h3><p className="mt-1 max-w-xl text-sm text-text-secondary">When a verified sale is attributed to you, this space will show the product, BVS fee, processing status, refund adjustments, and final payout.</p></div><Link href="/marketplace" className="bvs-wallet-empty-action">Browse marketplace</Link></div>}</section>

    <section className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]"><form onSubmit={submitWaitlist} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><h2 className="text-2xl font-semibold">Priority artist queue</h2><p className="mt-2 text-sm text-text-secondary">Deposits become platform credit for uploads, promotion, distribution, mixing, or mastering. They do not guarantee airplay or catalogue acceptance.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Artist name" value={form.artistName} onChange={(artistName) => setForm({ ...form, artistName })} required /><Field label="Contact name" value={form.contactName} onChange={(contactName) => setForm({ ...form, contactName })} /><Field label="Country" value={form.country} onChange={(country) => setForm({ ...form, country })} /><Field label="City" value={form.city} onChange={(city) => setForm({ ...form, city })} /><Field label="Instagram" value={form.instagram} onChange={(instagram) => setForm({ ...form, instagram })} /><Field label="Spotify / DSP link" value={form.spotify} onChange={(spotify) => setForm({ ...form, spotify })} /><Field label="Website / Link hub" value={form.website} onChange={(website) => setForm({ ...form, website })} className="sm:col-span-2" /><label className="text-sm font-medium sm:col-span-2">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand" /></label></div><button disabled={saving || !form.artistName} className="mt-6 rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-60">{saving ? 'Saving...' : data.waitlist ? 'Update queue entry' : 'Join artist queue'}</button></form><div className="space-y-6"><section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><h2 className="text-2xl font-semibold">Creditable deposit</h2><p className="mt-2 text-sm text-text-secondary">Reserve priority onboarding/review access. The deposit is recorded as BVS platform credit after payment is confirmed.</p><div className="mt-5 flex flex-wrap gap-3">{[5, 10, 20].map((amount) => <button key={amount} onClick={() => reserveDeposit(amount)} className="rounded-full border border-brand px-5 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-black">{money(amount)}</button>)}</div></section><section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><h2 className="text-2xl font-semibold">Payout readiness</h2><p className="mt-2 text-sm text-text-secondary">{nextPayout > 0 ? `${money(nextPayout)} more in posted balance is needed before payout requests open.` : 'Posted balance is above the current payout threshold.'}</p><p className="mt-3 text-xs text-text-secondary">Pending processor settlements do not count toward payout availability. Refunds and chargebacks remain visible as separate debits.</p></section></div></section>

    <section className="mt-12"><div className="mb-4"><p className="text-xs uppercase tracking-[.16em] text-brand">Wallet activity</p><h2 className="mt-1 text-2xl font-semibold">Recent balance movements</h2><p className="mt-2 text-sm text-text-secondary">Credits, deposits, and adjustments remain visible here even when they are not yet available for payout.</p></div><div className="grid gap-8 lg:grid-cols-2"><ActivityTable title="Wallet ledger" rows={data.ledger.map((entry) => [entry.entry_type.replaceAll('_', ' '), entry.status, `${entry.direction === 'debit' ? '−' : '+'}${money(entry.amount, entry.currency)}`, new Date(entry.effective_at).toLocaleDateString()])} empty="No wallet entries yet." /><ActivityTable title="Deposits" rows={data.deposits.map((deposit) => [deposit.source, deposit.status, money(deposit.amount, deposit.currency), new Date(deposit.created_at).toLocaleDateString()])} empty="No deposits yet." /></div></section>
  </main>
}

function AccessNotice({ title, text }: { title: string; text: string }) { return <main className="mx-auto min-h-[65vh] max-w-2xl px-6 py-20 text-center"><h1 className="text-3xl">{title}</h1><p className="mt-4 text-text-secondary">{text}</p><div className="mt-7 flex justify-center gap-3"><Link href="/auth/login" className="rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link><Link href="/auth/signup" className="rounded-full border border-white/20 px-6 py-3">Create account</Link></div></main> }
function Metric({ label, value, note, warning = false, compact = false }: { label: string; value: string; note?: string; warning?: boolean; compact?: boolean }) { return <div className={`rounded-xl border ${compact ? 'p-3' : 'p-5'} ${warning ? 'border-amber-400/30 bg-amber-400/[.06]' : 'border-white/10 bg-white/[0.03]'}`}><p className="text-xs text-text-secondary">{label}</p><p className={`${compact ? 'mt-1 text-xl' : 'mt-2 text-2xl'} font-semibold capitalize ${warning ? 'text-amber-200' : 'text-brand'}`}>{value}</p>{note ? <p className="mt-1 text-[11px] text-text-secondary">{note}</p> : null}</div> }
function FlowStep({ text }: { text: string }) { return <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{text}</span> }
function Arrow() { return <span className="font-semibold text-brand">→</span> }
function Field({ label, value, onChange, required, className = '' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; className?: string }) { return <label className={`text-sm font-medium ${className}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand" /></label> }
function ActivityTable({ title, rows, empty }: { title: string; rows: string[][]; empty: string }) { return <section className="bvs-wallet-activity-card"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{title}</h3><span className="bvs-wallet-count">{rows.length}</span></div>{rows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><tbody>{rows.map((row, index) => <tr key={`${row.join('-')}-${index}`} className="border-t border-white/10 first:border-t-0">{row.map((cell, cellIndex) => <td key={cellIndex} className={`py-3 pr-3 ${cellIndex === 0 ? 'capitalize font-medium text-white' : cellIndex === 2 ? 'text-right font-semibold text-brand' : 'text-text-secondary'}`}>{cell}</td>)}</tr>)}</tbody></table></div> : <div className="bvs-wallet-activity-empty"><span className="bvs-wallet-empty-icon">—</span><p>{empty}</p></div>}</section> }
