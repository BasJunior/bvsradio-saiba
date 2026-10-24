import 'server-only'
import { authUserId, serviceHeaders } from '@/lib/storage-upload'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export type PayoutMethodPublic = {
  id: string
  methodType: string
  label: string
  currency: string
  accountHolderName: string | null
  destinationSummary: string | null
  isDefault: boolean
  status: string
  createdAt: string | null
}

export type PayoutRequestPublic = {
  id: string
  payoutMethodId: string | null
  requestedAmount: number
  currency: string
  minimumAmountSnapshot: number
  status: string
  artistNote: string | null
  staffNote: string | null
  requestedAt: string | null
  approvedAt: string | null
  paidAt: string | null
  payoutReference: string | null
}

export function payoutConfigured() {
  return Boolean(url && service)
}

export async function payoutUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token || !payoutConfigured()) return null
  return authUserId(url, service, token)
}

export async function payoutGet<T>(path: string, fallback: T): Promise<T> {
  if (!payoutConfigured()) return fallback
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: serviceHeaders(service),
    cache: 'no-store',
  })
  if (!response.ok) return fallback
  return response.json()
}

export async function payoutPost<T>(path: string, body: unknown, prefer = 'return=representation'): Promise<T | null> {
  if (!payoutConfigured()) return null
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...serviceHeaders(service), Prefer: prefer },
    body: JSON.stringify(body),
  })
  if (!response.ok) return null
  const text = await response.text()
  return text ? JSON.parse(text) as T : null
}

export async function payoutPatch<T>(path: string, body: unknown): Promise<T | null> {
  if (!payoutConfigured()) return null
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders(service), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!response.ok) return null
  const text = await response.text()
  return text ? JSON.parse(text) as T : null
}

export async function payoutRpc<T>(name: string, body: Record<string, unknown>) {
  if (!payoutConfigured()) return { ok: false as const, status: 503, error: 'Payout service is not configured.' }
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: serviceHeaders(service),
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const raw = String(payload?.message || payload?.details || payload?.hint || '')
    return { ok: false as const, status: response.status, error: payoutRpcMessage(raw) }
  }
  return { ok: true as const, data: payload as T }
}

function payoutRpcMessage(raw: string) {
  if (raw.includes('payout_below_minimum')) return 'The payout amount is below the current minimum.'
  if (raw.includes('insufficient_withdrawable_balance')) return 'That amount is higher than your withdrawable balance after active payout requests.'
  if (raw.includes('active_payout_method_required')) return 'Choose an active payout method that belongs to your account.'
  if (raw.includes('payout_not_cancellable')) return 'Only payout requests that are still requested can be cancelled.'
  if (raw.includes('invalid_payout_transition')) return 'That payout status change is not allowed.'
  if (raw.includes('payout_reference_required')) return 'A payment reference is required before a payout can be marked paid.'
  if (raw.includes('insufficient_balance_to_mark_paid')) return 'The wallet no longer has enough posted balance to mark this payout paid.'
  if (raw.includes('payout_staff_permission_required')) return 'Wallet staff permission is required.'
  return raw || 'Payout operation failed.'
}

function number(value: unknown) {
  return Number(value) || 0
}

export function publicPayoutMethod(row: Record<string, unknown>): PayoutMethodPublic {
  return {
    id: String(row.id || ''),
    methodType: String(row.method_type || ''),
    label: String(row.label || ''),
    currency: String(row.currency || 'USD'),
    accountHolderName: row.account_holder_name ? String(row.account_holder_name) : null,
    destinationSummary: row.destination_summary ? String(row.destination_summary) : null,
    isDefault: Boolean(row.is_default),
    status: String(row.status || 'active'),
    createdAt: row.created_at ? String(row.created_at) : null,
  }
}

export function publicPayoutRequest(row: Record<string, unknown>): PayoutRequestPublic {
  return {
    id: String(row.id || ''),
    payoutMethodId: row.payout_method_id ? String(row.payout_method_id) : null,
    requestedAmount: number(row.requested_amount),
    currency: String(row.currency || 'USD'),
    minimumAmountSnapshot: number(row.minimum_amount_snapshot),
    status: String(row.status || 'requested'),
    artistNote: row.artist_note ? String(row.artist_note) : null,
    staffNote: row.staff_note ? String(row.staff_note) : null,
    requestedAt: row.requested_at ? String(row.requested_at) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    payoutReference: row.payout_reference ? String(row.payout_reference) : null,
  }
}

export async function artistPayoutSnapshot(userId: string) {
  const encoded = encodeURIComponent(userId)
  const [ledger, requests, methods, settings] = await Promise.all([
    payoutGet<Array<Record<string, unknown>>>(`artist_ledger_entries?artist_user_id=eq.${encoded}&status=eq.posted&select=direction,amount,currency&limit=5000`, []),
    payoutGet<Array<Record<string, unknown>>>(`artist_payout_requests?artist_user_id=eq.${encoded}&select=*&order=requested_at.desc&limit=100`, []),
    payoutGet<Array<Record<string, unknown>>>(`artist_payout_methods?artist_user_id=eq.${encoded}&select=id,method_type,label,currency,account_holder_name,destination_summary,is_default,status,created_at&order=is_default.desc,created_at.desc&limit=30`, []),
    payoutGet<Array<{ value?: { amount?: number | string; currency?: string } }>>('artist_wallet_settings?key=eq.payout_minimum_usd&select=value&limit=1', []),
  ])

  const balances = new Map<string, number>()
  for (const entry of ledger) {
    const currency = String(entry.currency || 'USD')
    const amount = number(entry.amount)
    balances.set(currency, (balances.get(currency) || 0) + (entry.direction === 'credit' ? amount : -amount))
  }

  const reserved = new Map<string, number>()
  for (const request of requests) {
    if (!['requested', 'approved', 'processing'].includes(String(request.status || ''))) continue
    const currency = String(request.currency || 'USD')
    reserved.set(currency, (reserved.get(currency) || 0) + number(request.requested_amount))
  }

  const currency = String(settings[0]?.value?.currency || 'USD')
  const available = Math.round((balances.get(currency) || 0) * 100) / 100
  const activeReserved = Math.round((reserved.get(currency) || 0) * 100) / 100

  return {
    settings: {
      payoutMinimumUsd: number(settings[0]?.value?.amount || 25),
      currency,
    },
    balances: {
      available,
      reserved: activeReserved,
      withdrawable: Math.max(0, Math.round((available - activeReserved) * 100) / 100),
    },
    methods: methods.map(publicPayoutMethod),
    requests: requests.map(publicPayoutRequest),
  }
}
