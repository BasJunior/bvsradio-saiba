import 'server-only'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }

type OrderRow = { id: string; reference: string; customer_user_id?: string; items?: Array<{ type?: string; price?: number; quantity?: number }> }

export async function creditPaidArtistDeposit(reference: string, source: 'stripe' | 'paynow') {
  if (!url || !service || !reference) return { credited: false, reason: 'not_configured' }
  const orderResponse = await fetch(`${url}/rest/v1/orders?reference=eq.${encodeURIComponent(reference)}&select=id,reference,customer_user_id,items&limit=1`, { headers, cache: 'no-store' })
  if (!orderResponse.ok) return { credited: false, reason: 'order_lookup_failed' }
  const [order] = await orderResponse.json() as OrderRow[]
  if (!order?.customer_user_id) return { credited: false, reason: 'anonymous_order' }
  const amount = (order.items || []).filter(item => item.type === 'artist_deposit').reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
  if (amount <= 0) return { credited: false, reason: 'not_artist_deposit' }

  const externalReference = `${source}:${reference}`
  const depositResponse = await fetch(`${url}/rest/v1/artist_deposits?on_conflict=source,external_reference`, {
    method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ artist_user_id: order.customer_user_id, amount, currency: 'USD', status: 'credited', source,
      external_reference: externalReference, order_id: order.id, received_at: new Date().toISOString(),
      creditable_at: new Date().toISOString(), credited_at: new Date().toISOString() }),
  })
  if (!depositResponse.ok) return { credited: false, reason: 'deposit_save_failed' }
  const [deposit] = await depositResponse.json() as Array<{ id: string }>
  if (!deposit?.id) return { credited: false, reason: 'deposit_missing' }

  const existingResponse = await fetch(`${url}/rest/v1/artist_ledger_entries?deposit_id=eq.${deposit.id}&entry_type=eq.deposit_credit&select=id&limit=1`, { headers, cache: 'no-store' })
  if (existingResponse.ok && (await existingResponse.json()).length) return { credited: true, idempotent: true }
  const ledgerResponse = await fetch(`${url}/rest/v1/artist_ledger_entries`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ artist_user_id: order.customer_user_id, direction: 'credit', entry_type: 'deposit_credit',
      amount, currency: 'USD', status: 'posted', source_table: 'orders', source_id: order.id,
      deposit_id: deposit.id, memo: `Creditable BVS artist deposit ${reference}`, metadata: { reference, source } }),
  })
  if (!ledgerResponse.ok) return { credited: false, reason: 'ledger_save_failed' }
  return { credited: true, idempotent: false }
}
