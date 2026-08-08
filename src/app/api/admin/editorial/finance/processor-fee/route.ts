import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { creditPaidArtistSales } from '@/lib/artist-credit'
import { MARKETPLACE_POLICY_VERSION } from '@/lib/marketplace-economics'

const ALLOWED_ROLES = new Set(['founder', 'administrator', 'commerce_manager'])

export async function POST(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity || !ALLOWED_ROLES.has(String(identity.role))) {
    return NextResponse.json({ error: 'Founder, Administrator or Commerce Manager access is required.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const reference = String(body.reference || '').trim()
  const provider = String(body.provider || '').toLowerCase()
  const amountOrderCurrency = Number(body.amountOrderCurrency)
  const status = body.status === 'schedule' ? 'schedule' : 'actual'
  const nativeAmount = body.nativeAmount == null ? null : Number(body.nativeAmount)
  const nativeCurrency = body.nativeCurrency == null ? null : String(body.nativeCurrency).toUpperCase()

  if (!reference || !['stripe', 'paynow'].includes(provider)) {
    return NextResponse.json({ error: 'Reference and provider are required.' }, { status: 400 })
  }
  if (!Number.isFinite(amountOrderCurrency) || amountOrderCurrency < 0) {
    return NextResponse.json({ error: 'Enter a valid processor fee in the order currency.' }, { status: 400 })
  }

  const result = await creditPaidArtistSales(reference, provider as 'stripe' | 'paynow', {
    amountOrderCurrency: Math.round(amountOrderCurrency * 100) / 100,
    status,
    nativeAmount: Number.isFinite(nativeAmount) ? Math.round(Number(nativeAmount) * 100) / 100 : null,
    nativeCurrency,
  })

  if (result.reason && !result.credited) {
    return NextResponse.json({ error: result.reason, result }, { status: 409 })
  }

  try {
    await fetch(editorialUrl('marketplace_fee_policy_audit'), {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({
        policy_version: MARKETPLACE_POLICY_VERSION,
        actor_user_id: identity.user.id,
        action: 'processor_fee_reconciled',
        details: { reference, provider, amountOrderCurrency, status, nativeAmount, nativeCurrency },
      }),
    })
  } catch {
    // Reconciliation is authoritative even if auxiliary audit persistence is temporarily unavailable.
  }

  return NextResponse.json({ ok: true, result })
}
