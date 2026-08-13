import { NextResponse } from 'next/server'
import { editorialUrl, serviceHeaders } from '@/lib/editorial-server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

type SupabaseUser = {
  id: string
  email?: string
  user_metadata?: { full_name?: string; username?: string }
}

type SettlementRow = Record<string, unknown> & {
  order_reference?: string
  gross_product_revenue?: number | string
  platform_fee_amount?: number | string
  processor_fee_allocated?: number | string
  seller_net?: number | string
  settlement_status?: string
}

type SettlementView = SettlementRow & {
  refunds: number
  payout_net: number
  tax_excluded: true
}

const RADIO_EARNINGS_ENTRY_TYPES = new Set(['royalty_credit'])
const FOUNDING_BONUS_ENTRY_TYPES = new Set(['founding_artist_bonus', 'promotional_credit'])

function isFoundingBonus(entry: { entry_type?: string; metadata?: Record<string, unknown> }) {
  return FOUNDING_BONUS_ENTRY_TYPES.has(String(entry.entry_type || ''))
    || (entry.entry_type === 'manual_credit' && entry.metadata?.program === 'founding_artist_bonus')
}

function postedCreditTotal(
  entries: Array<{ direction: string; amount: number | string; status: string; entry_type?: string; metadata?: Record<string, unknown> }>,
  matches: (entry: { entry_type?: string; metadata?: Record<string, unknown> }) => boolean,
) {
  return entries
    .filter((entry) => entry.direction === 'credit' && entry.status === 'posted' && matches(entry))
    .reduce((total, entry) => total + (Number(entry.amount) || 0), 0)
}

async function currentUser(request: Request): Promise<SupabaseUser | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY || !serviceHeaders.apikey) return null
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) return null
  return response.json()
}

async function getJson<T>(path: string, fallback: T): Promise<T> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) return fallback
  return response.json()
}

function balance(entries: Array<{ direction: string; amount: number | string; status: string }>) {
  return entries
    .filter((entry) => entry.status === 'posted')
    .reduce((sum, entry) => {
      const amount = Number(entry.amount) || 0
      return entry.direction === 'credit' ? sum + amount : sum - amount
    }, 0)
}

function sum(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)
}

export async function GET(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to view artist wallet.' }, { status: 401 })
  if (!serviceHeaders.apikey) return NextResponse.json({ error: 'Artist wallet is not configured.' }, { status: 503 })

  const email = encodeURIComponent(user.email || '')
  const userId = encodeURIComponent(user.id)
  const [profile, waitlist, deposits, ledger, payoutMethods, payoutRequests, settings, rawSettlements, tracks] = await Promise.all([
    getJson<Array<Record<string, unknown>>>(`profiles?id=eq.${userId}&select=id,username,display_name,role,is_verified,is_published`, []),
    user.email ? getJson<Array<Record<string, unknown>>>(`artist_waitlist?email=eq.${email}&select=*&order=created_at.desc&limit=1`, []) : Promise.resolve([]),
    getJson<Array<{ amount: number | string; status: string } & Record<string, unknown>>>(`artist_deposits?artist_user_id=eq.${userId}&select=*&order=created_at.desc&limit=20`, []),
    getJson<Array<{ direction: string; amount: number | string; status: string; entry_type?: string; metadata?: Record<string, unknown> } & Record<string, unknown>>>(`artist_ledger_entries?artist_user_id=eq.${userId}&select=*&order=effective_at.desc&limit=100`, []),
    getJson<Array<Record<string, unknown>>>(`artist_payout_methods?artist_user_id=eq.${userId}&select=*&order=created_at.desc&limit=10`, []),
    getJson<Array<Record<string, unknown>>>(`artist_payout_requests?artist_user_id=eq.${userId}&select=*&order=requested_at.desc&limit=20`, []),
    getJson<Array<{ value?: { amount?: number | string; currency?: string } }>>(`artist_wallet_settings?key=eq.payout_minimum_usd&select=value&limit=1`, []),
    getJson<SettlementRow[]>(`commerce_seller_settlements?seller_user_id=eq.${userId}&select=id,order_reference,provider,policy_version,seller_plan_id,gross_product_revenue,platform_fee_bps,platform_fee_amount,processor_fee_allocated,processor_fee_status,processor_fee_native_amount,processor_fee_native_currency,seller_net,settlement_status,breakdown,created_at&order=created_at.desc&limit=60`, []),
    getJson<Array<{ play_count?: number | string }>>(`tracks?user_id=eq.${userId}&select=play_count&is_public=eq.true&editorial_status=eq.approved&limit=2000`, []),
  ])

  const refundByReference = new Map<string, number>()
  for (const entry of ledger) {
    if (entry.direction !== 'debit' || !['refund_debit', 'reversal_debit'].includes(String(entry.entry_type || ''))) continue
    const reference = String(entry.metadata?.reference || '')
    if (!reference) continue
    refundByReference.set(reference, (refundByReference.get(reference) || 0) + (Number(entry.amount) || 0))
  }

  const sellerSettlements: SettlementView[] = rawSettlements.map((row) => {
    const reference = String(row.order_reference || '')
    const refunds = Math.round((refundByReference.get(reference) || 0) * 100) / 100
    const sellerNet = Number(row.seller_net) || 0
    return {
      ...row,
      refunds,
      payout_net: Math.max(0, Math.round((sellerNet - refunds) * 100) / 100),
      tax_excluded: true,
    }
  })

  const pendingSaleCredits = ledger
    .filter((entry) => entry.status === 'pending' && entry.entry_type === 'sale_credit')
    .reduce((total, entry) => total + (Number(entry.amount) || 0), 0)
  const postedSettlements = sellerSettlements.filter((row) => row.settlement_status === 'posted')
  const refundDebits = [...refundByReference.values()].reduce((total, amount) => total + amount, 0)
  const foundingBonus = postedCreditTotal(ledger, isFoundingBonus)
  const radioEarnings = postedCreditTotal(ledger, (entry) => RADIO_EARNINGS_ENTRY_TYPES.has(String(entry.entry_type || '')))
  const marketplaceEarnings = postedCreditTotal(ledger, (entry) => entry.entry_type === 'sale_credit')
  const eligiblePlays = tracks.reduce((total, track) => total + (Number(track.play_count) || 0), 0)
  const availableBalance = balance(ledger)
  const otherCreditsAndAdjustments = availableBalance - marketplaceEarnings - radioEarnings - foundingBonus

  return NextResponse.json({
    profile: profile[0] || null,
    waitlist: waitlist[0] || null,
    deposits,
    ledger,
    payoutMethods,
    payoutRequests,
    sellerSettlements,
    settings: {
      payoutMinimumUsd: Number(settings[0]?.value?.amount || 25),
      currency: settings[0]?.value?.currency || 'USD',
    },
    balances: {
      available: availableBalance,
      pendingDeposits: deposits.filter((deposit) => ['pending', 'creditable'].includes(String(deposit.status))).reduce((total, deposit) => total + (Number(deposit.amount) || 0), 0),
      pendingEarnings: pendingSaleCredits,
    },
    earnings: {
      lifetimeGrossSales: sum(sellerSettlements, 'gross_product_revenue'),
      bvsPlatformFees: sum(sellerSettlements, 'platform_fee_amount'),
      processorFees: sum(sellerSettlements, 'processor_fee_allocated'),
      refundDebits,
      postedNetEarnings: sum(postedSettlements, 'seller_net'),
      netAfterRefunds: Math.max(0, sum(postedSettlements, 'seller_net') - refundDebits),
      pendingNetEarnings: sum(sellerSettlements.filter((row) => row.settlement_status === 'pending_processor'), 'seller_net'),
      settlementCount: sellerSettlements.length,
    },
    sources: {
      marketplaceEarnings,
      radioEarnings,
      foundingBonus,
      otherCreditsAndAdjustments,
    },
    radio: {
      eligiblePlays,
      fundedEarnings: radioEarnings,
      settlementStatus: radioEarnings > 0 ? 'credited' : 'awaiting_funded_programme',
    },
  })
}

export async function POST(request: Request) {
  const user = await currentUser(request)
  if (!user?.email) return NextResponse.json({ error: 'Sign in to join the artist queue.' }, { status: 401 })
  if (!serviceHeaders.apikey) return NextResponse.json({ error: 'Artist wallet is not configured.' }, { status: 503 })

  const body = await request.json()
  const artistName = String(body.artistName || user.user_metadata?.full_name || user.user_metadata?.username || '').trim().slice(0, 160)
  if (!artistName) return NextResponse.json({ error: 'Artist name is required.' }, { status: 400 })

  const payload = {
    email: user.email,
    artist_name: artistName,
    contact_name: String(body.contactName || user.user_metadata?.full_name || '').trim().slice(0, 160) || null,
    country: String(body.country || '').trim().slice(0, 80) || null,
    city: String(body.city || '').trim().slice(0, 80) || null,
    links: {
      instagram: String(body.instagram || '').trim().slice(0, 240),
      spotify: String(body.spotify || '').trim().slice(0, 240),
      website: String(body.website || '').trim().slice(0, 240),
    },
    notes: String(body.notes || '').trim().slice(0, 1000) || null,
    source: 'artist_hub',
    status: 'new',
    onboarded_profile_id: user.id,
  }

  let response = await fetch(editorialUrl('artist_waitlist?on_conflict=email'), {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    response = await fetch(editorialUrl('artist_waitlist'), {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    })
  }
  if (!response.ok) {
    return NextResponse.json({ error: 'Artist wallet schema is not ready. Run the wallet and marketplace economics SQL packs in Supabase.' }, { status: 503 })
  }
  const [savedWaitlist] = await response.json()
  return NextResponse.json({ waitlist: savedWaitlist })
}
