import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { reverseMarketplaceSellerCreditsByReference } from '@/lib/marketplace-refunds'
import { MARKETPLACE_POLICY_VERSION } from '@/lib/marketplace-economics'

const ALLOWED_ROLES = new Set(['founder', 'administrator', 'commerce_manager'])

export async function POST(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity || !ALLOWED_ROLES.has(String(identity.role))) {
    return NextResponse.json({ error: 'Founder, Administrator or Commerce Manager access is required.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const reference = String(body.reference || '').trim()
  const provider = body.provider === 'paynow' ? 'paynow' : 'manual'
  const externalEventId = String(body.externalEventId || '').trim()
  const fraction = Number(body.fraction ?? 1)
  const providerAmount = body.providerAmount == null || body.providerAmount === '' ? null : Number(body.providerAmount)
  const providerCurrency = body.providerCurrency == null ? null : String(body.providerCurrency).toUpperCase()

  if (!reference || !externalEventId) {
    return NextResponse.json({ error: 'Order reference and external refund/reversal reference are required.' }, { status: 400 })
  }
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    return NextResponse.json({ error: 'Reversal fraction must be greater than 0 and no more than 1.' }, { status: 400 })
  }
  if (providerAmount != null && (!Number.isFinite(providerAmount) || providerAmount < 0)) {
    return NextResponse.json({ error: 'Provider amount must be a valid non-negative amount.' }, { status: 400 })
  }

  const result = await reverseMarketplaceSellerCreditsByReference({
    reference,
    provider,
    externalEventId,
    fraction,
    providerAmount,
    providerCurrency,
  })
  if (!result.reversed && !Boolean((result as { duplicate?: boolean }).duplicate)) {
    return NextResponse.json({ error: result.reason || 'Could not reverse seller earnings.', result }, { status: 409 })
  }

  try {
    await fetch(editorialUrl('marketplace_fee_policy_audit'), {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({
        policy_version: MARKETPLACE_POLICY_VERSION,
        actor_user_id: identity.user.id,
        action: provider === 'paynow' ? 'paynow_refund_wallet_reversal' : 'manual_wallet_reversal',
        details: { reference, provider, externalEventId, fraction, providerAmount, providerCurrency },
      }),
    })
  } catch {
    // Refund event + ledger debit are canonical; policy audit is additional visibility.
  }

  return NextResponse.json({ ok: true, result })
}
