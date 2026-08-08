import { NextResponse } from 'next/server'
import { editorialUrl, serviceHeaders } from '@/lib/editorial-server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

type SupabaseUser = {
  id: string
  email?: string
  user_metadata?: { full_name?: string; username?: string }
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

/** Artist Access hub is an onboarding entry — any signed-in member may open it. */
export async function GET(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to view artist wallet.' }, { status: 401 })
  if (!serviceHeaders.apikey) {
    return NextResponse.json({ error: 'Artist wallet is not configured.' }, { status: 503 })
  }

  const email = encodeURIComponent(user.email || '')
  const userId = encodeURIComponent(user.id)
  const [profile, waitlist, deposits, ledger, payoutMethods, payoutRequests, settings, sellerSettlements] = await Promise.all([
    getJson<Array<Record<string, unknown>>>(`profiles?id=eq.${userId}&select=id,username,display_name,role,is_verified,is_published`, []),
    user.email
      ? getJson<Array<Record<string, unknown>>>(`artist_waitlist?email=eq.${email}&select=*&order=created_at.desc&limit=1`, [])
      : Promise.resolve([]),
    getJson<Array<{ amount: number | string; status: string } & Record<string, unknown>>>(`artist_deposits?artist_user_id=eq.${userId}&select=*&order=created_at.desc&limit=20`, []),
    getJson<Array<{ direction: string; amount: number | string; status: string } & Record<string, unknown>>>(`artist_ledger_entries?artist_user_id=eq.${userId}&select=*&order=effective_at.desc&limit=80`, []),
    getJson<Array<Record<string, unknown>>>(`artist_payout_methods?artist_user_id=eq.${userId}&select=*&order=created_at.desc&limit=10`, []),
    getJson<Array<Record<string, unknown>>>(`artist_payout_requests?artist_user_id=eq.${userId}&select=*&order=requested_at.desc&limit=20`, []),
    getJson<Array<{ value?: { amount?: number | string; currency?: string } }>>(`artist_wallet_settings?key=eq.payout_minimum_usd&select=value&limit=1`, []),
    getJson<Array<Record<string, unknown>>>(`commerce_seller_settlements?seller_user_id=eq.${userId}&select=id,order_reference,provider,policy_version,seller_plan_id,gross_product_revenue,platform_fee_bps,platform_fee_amount,processor_fee_allocated,processor_fee_status,processor_fee_native_amount,processor_fee_native_currency,seller_net,settlement_status,breakdown,created_at&order=created_at.desc&limit=60`, []),
  ])

  const pendingSaleCredits = ledger
    .filter((entry) => entry.status === 'pending' && entry.entry_type === 'sale_credit')
    .reduce((total, entry) => total + (Number(entry.amount) || 0), 0)
  const postedSettlements = sellerSettlements.filter((row) => row.settlement_status === 'posted')

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
      available: balance(ledger),
      pendingDeposits: deposits
        .filter((deposit) => ['pending', 'creditable'].includes(String(deposit.status)))
        .reduce((total, deposit) => total + (Number(deposit.amount) || 0), 0),
      pendingEarnings: pendingSaleCredits,
    },
    earnings: {
      lifetimeGrossSales: sum(sellerSettlements, 'gross_product_revenue'),
      bvsPlatformFees: sum(sellerSettlements, 'platform_fee_amount'),
      processorFees: sum(sellerSettlements, 'processor_fee_allocated'),
      postedNetEarnings: sum(postedSettlements, 'seller_net'),
      pendingNetEarnings: sum(sellerSettlements.filter((row) => row.settlement_status === 'pending_processor'), 'seller_net'),
      settlementCount: sellerSettlements.length,
    },
  })
}

export async function POST(request: Request) {
  const user = await currentUser(request)
  if (!user?.email) return NextResponse.json({ error: 'Sign in to join the artist queue.' }, { status: 401 })
  if (!serviceHeaders.apikey) {
    return NextResponse.json({ error: 'Artist wallet is not configured.' }, { status: 503 })
  }

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
    return NextResponse.json(
      { error: 'Artist wallet schema is not ready. Run the wallet and marketplace economics SQL packs in Supabase.' },
      { status: 503 },
    )
  }
  const [savedWaitlist] = await response.json()
  return NextResponse.json({ waitlist: savedWaitlist })
}
