import 'server-only'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

type SettlementRow = {
  id: string
  seller_user_id: string
  seller_net: number | string
  settlement_status: string
}

export async function reverseMarketplaceSellerCredits(input: {
  paymentIntentId: string
  providerEventId: string
  reason: 'refund' | 'chargeback'
  fraction?: number
  providerAmount?: number | null
  providerCurrency?: string | null
}) {
  if (!url || !service || !input.paymentIntentId || !input.providerEventId) {
    return { reversed: false, reason: 'not_configured' }
  }

  const orderResponse = await fetch(
    `${url}/rest/v1/orders?stripe_payment_intent=eq.${encodeURIComponent(input.paymentIntentId)}&select=id,reference&limit=1`,
    { headers, cache: 'no-store' },
  )
  if (!orderResponse.ok) return { reversed: false, reason: 'order_lookup_failed' }
  const [order] = await orderResponse.json() as Array<{ id: string; reference: string }>
  if (!order?.id) return { reversed: false, reason: 'order_not_found' }

  const duplicateResponse = await fetch(
    `${url}/rest/v1/commerce_refund_events?provider=eq.stripe&provider_event_id=eq.${encodeURIComponent(input.providerEventId)}&select=id&limit=1`,
    { headers, cache: 'no-store' },
  )
  if (duplicateResponse.ok && (await duplicateResponse.json() as Array<{ id: string }>).length) {
    return { reversed: true, duplicate: true }
  }

  const settlementResponse = await fetch(
    `${url}/rest/v1/commerce_seller_settlements?order_id=eq.${order.id}&settlement_status=in.(posted,reversed)&select=id,seller_user_id,seller_net,settlement_status`,
    { headers, cache: 'no-store' },
  )
  if (!settlementResponse.ok) return { reversed: false, reason: 'settlement_lookup_failed' }
  const settlements = await settlementResponse.json() as SettlementRow[]
  if (!settlements.length) return { reversed: false, reason: 'no_seller_settlement' }

  const fraction = Math.max(0, Math.min(1, Number(input.fraction ?? 1)))
  if (fraction <= 0) return { reversed: false, reason: 'zero_fraction' }

  const refundEventResponse = await fetch(`${url}/rest/v1/commerce_refund_events`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      provider: 'stripe',
      provider_event_id: input.providerEventId,
      order_id: order.id,
      order_reference: order.reference,
      event_type: input.reason,
      provider_amount: input.providerAmount ?? null,
      provider_currency: input.providerCurrency ?? null,
      reversal_fraction: fraction,
    }),
  })
  if (!refundEventResponse.ok) {
    if (refundEventResponse.status === 409) return { reversed: true, duplicate: true }
    return { reversed: false, reason: 'refund_event_save_failed' }
  }
  const [refundEvent] = await refundEventResponse.json() as Array<{ id: string }>

  let entries = 0
  for (const settlement of settlements) {
    const amount = roundMoney((Number(settlement.seller_net) || 0) * fraction)
    if (amount <= 0) continue

    const ledgerResponse = await fetch(`${url}/rest/v1/artist_ledger_entries`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        artist_user_id: settlement.seller_user_id,
        direction: 'debit',
        entry_type: input.reason === 'refund' ? 'refund_debit' : 'reversal_debit',
        amount,
        currency: 'USD',
        status: 'posted',
        source_table: 'commerce_refund_events',
        source_id: refundEvent.id,
        memo: `${input.reason === 'refund' ? 'Refund' : 'Chargeback'} reversal for ${order.reference}`,
        metadata: {
          reference: order.reference,
          provider: 'stripe',
          providerEventId: input.providerEventId,
          fraction,
          originalSellerNet: Number(settlement.seller_net) || 0,
        },
      }),
    })
    if (!ledgerResponse.ok) return { reversed: false, reason: 'ledger_debit_failed', entries }
    entries += 1

    if (fraction >= 0.9999 && settlement.settlement_status !== 'reversed') {
      await fetch(`${url}/rest/v1/commerce_seller_settlements?id=eq.${settlement.id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ settlement_status: 'reversed', updated_at: new Date().toISOString() }),
      })
    }
  }

  return { reversed: entries > 0, entries, fraction, reference: order.reference }
}
